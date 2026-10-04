#!/usr/bin/env node
// The Current Affairs refresh for a Claude subscription, run by
// .github/workflows/current-affairs-subscription.yml through the Claude Code GitHub Action.
// A subscription can't call the API directly, so Claude Code does the two model steps and
// this script does everything else, with the same rules as refresh-current-affairs.mjs:
//
//   node scripts/factcheck/subscription.mjs prepare [countries...] [--fresh 2]
//       -> .factcheck/writer-task.md            (Claude Code writes .factcheck/proposals/<country>.json)
//   node scripts/factcheck/subscription.mjs screen
//       -> schema/difficulty/duplicate checks, then .factcheck/check-task.md
//                                                (a fresh Claude Code session writes .factcheck/verdicts.json)
//   node scripts/factcheck/subscription.mjs apply --summary pr-body.md
//       -> applies only proposals the fact-check marked "ok", and writes the PR body
//
// Everything Claude writes is read as untrusted data: unparseable or malformed output
// is rejected, never executed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { countryIds, FACTCHECK_SYSTEM, factcheckPrompt, loadBank, questionItem, ROOT, today, VERDICT_TOOL, writeBank } from './lib.mjs';
import { applyVerified, CHANGES_SCHEMA, renderRefreshSummary, screenProposals, WRITER_SYSTEM, writerPrompt } from './refresh-core.mjs';

const DIR = `${ROOT}.factcheck`;
const STATE = `${DIR}/state.json`;
const [command, ...rest] = process.argv.slice(2);
const opt = (name, dflt) => (rest.includes(name) ? rest[rest.indexOf(name) + 1] : dflt);
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const setOutput = (key, value) => {
  if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`, { flag: 'a' });
};

if (command === 'prepare') prepare();
else if (command === 'screen') screen();
else if (command === 'apply') apply();
else {
  console.error('usage: subscription.mjs prepare [countries...] [--fresh N] | screen | apply [--summary FILE]');
  process.exit(2);
}

function prepare() {
  const positional = rest.filter((a, i) => !a.startsWith('--') && rest[i - 1] !== '--fresh');
  const countries = positional.length ? positional : countryIds();
  const fresh = Number(opt('--fresh', 2));
  if (!Number.isInteger(fresh) || fresh < 0 || fresh > 5) fail('--fresh must be a whole number from 0 to 5');
  const unknown = countries.filter((c) => !countryIds().includes(c));
  if (unknown.length) fail(`unknown country id(s): ${unknown.join(', ')}`);

  mkdirSync(`${DIR}/proposals`, { recursive: true });
  writeFileSync(STATE, JSON.stringify({ countries, fresh, today: today() }, null, 2));
  const sections = countries.map(
    (c) => `### ${c}\n\nWrite your result to \`.factcheck/proposals/${c}.json\`.\n\n${writerPrompt(c, loadBank(c).topics['current-affairs'], { fresh, today: today() })}`,
  );
  writeFileSync(
    `${DIR}/writer-task.md`,
    `# Current Affairs refresh

${WRITER_SYSTEM}

## How to work

Handle the ${countries.length} countries below one at a time, in order. For each one, use web search to check the existing questions and find recent news, then immediately write that country's JSON file before moving on (so nothing is lost if the session is interrupted). Write a file for every country, even when the answer is \`{"changes": []}\`.

Each file must be a single JSON object matching this JSON Schema exactly (no comments, no trailing text):

\`\`\`json
${JSON.stringify(CHANGES_SCHEMA, null, 2)}
\`\`\`

Only write files inside \`.factcheck/proposals/\`. Do not edit any other file in the repository.

## Countries

${sections.join('\n\n')}
`,
  );
  console.error(`wrote .factcheck/writer-task.md for ${countries.length} countries`);
}

function screen() {
  const { countries, fresh } = readJson(STATE);
  const report = [];
  const candidates = [];
  for (const country of countries) {
    const bank = loadBank(country);
    const qs = bank.topics['current-affairs'];
    const path = `${DIR}/proposals/${country}.json`;
    let changes;
    try {
      changes = readJson(path).changes;
      if (!Array.isArray(changes)) throw new Error('"changes" is not a list');
    } catch (e) {
      report.push({ country, error: existsSync(path) ? `unreadable proposals: ${e.message}` : 'no proposals file written', applied: [], rejected: [] });
      continue;
    }
    const screened = screenProposals(qs, changes, { fresh, bankTexts: Object.values(bank.topics).flat().map((q) => q.q) });
    report.push({ country, applied: [], rejected: screened.rejected });
    for (const ch of screened.candidates) candidates.push({ country, ...ch, sources: Array.isArray(ch.sources) ? ch.sources.map(String) : [] });
  }
  writeFileSync(`${DIR}/screened.json`, JSON.stringify({ report, candidates }, null, 2));

  const byCountry = Map.groupBy(candidates, (c) => c.country);
  const sections = [...byCountry].map(([country, chs]) =>
    factcheckPrompt(chs.map((ch) => questionItem(ch.question, `${country}/new#${ch.index}`)), { country, topic: 'current-affairs (newly written)' }),
  );
  const verdictSchema = { type: 'object', required: ['verdicts'], properties: { verdicts: VERDICT_TOOL.input_schema.properties.verdicts } };
  writeFileSync(
    `${DIR}/check-task.md`,
    `# Fact-check

${FACTCHECK_SYSTEM.replace('call report_verdicts once with a verdict for every item id', 'write your verdicts to the file described below')}

You have not seen how these questions were written; judge each one on its own. Use web search for every item, since they are about recent events.

When finished, write \`.factcheck/verdicts.json\`: one JSON object matching this JSON Schema, with exactly one verdict for every item id below (no comments, no trailing text). Do not edit any other file.

\`\`\`json
${JSON.stringify(verdictSchema, null, 2)}
\`\`\`

${sections.join('\n\n---\n\n')}
`,
  );
  setOutput('candidates', candidates.length);
  console.error(`${candidates.length} proposal(s) passed screening; ${report.reduce((n, r) => n + r.rejected.length, 0)} rejected`);
}

function apply() {
  const { report, candidates } = readJson(`${DIR}/screened.json`);
  const verdicts = new Map();
  if (candidates.length) {
    try {
      for (const v of readJson(`${DIR}/verdicts.json`).verdicts ?? []) if (typeof v?.id === 'string') verdicts.set(v.id, v);
    } catch (e) {
      console.error(`no usable verdicts (${e.message}); nothing will be applied`);
    }
  }
  for (const r of report) {
    if (r.error) continue;
    const chs = candidates.filter((c) => c.country === r.country);
    if (!chs.length) continue;
    const bank = loadBank(r.country);
    const local = new Map(chs.map((c) => [`new#${c.index}`, verdicts.get(`${r.country}/new#${c.index}`)]));
    const result = applyVerified(bank.topics['current-affairs'], chs, local);
    r.applied.push(...result.applied);
    r.rejected.push(...result.rejected);
    if (result.applied.length) writeBank(r.country, bank);
  }
  const changed = report.reduce((n, r) => n + r.applied.length, 0);
  const summary = opt('--summary');
  if (summary)
    writeFileSync(summary, renderRefreshSummary(report, `Automated Current Affairs refresh for ${today()}, written and checked by Claude Code (Sonnet 5.5) on a Claude subscription.`));
  setOutput('changed', changed);
  console.error(`${changed} question(s) changed`);
  if (report.every((r) => r.error)) process.exit(1);
}

function fail(message) {
  console.error(message);
  process.exit(2);
}
