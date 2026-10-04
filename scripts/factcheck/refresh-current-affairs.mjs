#!/usr/bin/env node
// Refresh the Current Affairs question banks with Claude + web search.
// Run by .github/workflows/current-affairs.yml on the 1st and 15th of each month;
// the result lands as a pull request for a human to review.
//
//   node scripts/factcheck/refresh-current-affairs.mjs                  # every country
//   node scripts/factcheck/refresh-current-affairs.mjs japan kenya      # some countries
//   node scripts/factcheck/refresh-current-affairs.mjs --fresh 3 --summary pr-body.md --result result.json
//
// Per country:
//   1. A writer call reads the 25 current-affairs questions, searches the news, and proposes
//      (a) rewrites of questions that are no longer true, and (b) up to --fresh new questions
//      about recent events, each replacing a stale question of the same difficulty.
//   2. Each proposal must pass the content schema (same rules as scripts/validate-content.mjs).
//   3. A separate fact-check call (fresh context, no sight of the writer's reasoning) checks
//      the proposals; anything not verdict "ok" is dropped and the original question stays.
// The bank therefore keeps its size and difficulty mix, and every change is double-checked.
import { writeFileSync } from 'node:fs';
import {
  addUsage, checkItems, costUsd, countryIds, loadBank, MODEL, questionItem, runToolTurns, today, writeBank,
} from './lib.mjs';
import { applyVerified, CHANGES_SCHEMA, renderRefreshSummary, screenProposals, WRITER_SYSTEM, writerPrompt } from './refresh-core.mjs';

const PROPOSE_TOOL = {
  name: 'propose_changes',
  description: 'Submit every proposed change to the bank. Call once, at the end. An empty list is fine.',
  strict: true,
  input_schema: CHANGES_SCHEMA,
};

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const optNames = ['--fresh', '--summary', '--result', '--concurrency'];
const positional = args.filter((a, i) => !a.startsWith('--') && !optNames.includes(args[i - 1]));
const countries = positional.length ? positional : countryIds();
const fresh = Number(opt('--fresh', 2));
const summaryPath = opt('--summary');
const concurrency = Number(opt('--concurrency', 3));
if (!Number.isInteger(fresh) || fresh < 0 || fresh > 5) {
  console.error('--fresh must be a whole number from 0 to 5');
  process.exit(2);
}
const unknown = countries.filter((c) => !countryIds().includes(c));
if (unknown.length) {
  console.error(`unknown country id(s): ${unknown.join(', ')}`);
  process.exit(2);
}
if (args.includes('--dry-run')) {
  console.error(`${countries.length} countries × (1 writer + 1 fact-check call), up to ${fresh} fresh questions each, model ${MODEL}`);
  process.exit(0);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set');
  process.exit(2);
}

const report = [];
let usage = {};
let next = 0;
async function worker() {
  while (next < countries.length) {
    const country = countries[next++];
    try {
      report.push(await refresh(country));
    } catch (e) {
      usage = addUsage(usage, e.usage);
      console.error(`  ${country}: FAILED (${e.failure_class ?? 'error'}): ${e.message}`);
      report.push({ country, error: e.message, applied: [], rejected: [] });
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
report.sort((a, b) => countries.indexOf(a.country) - countries.indexOf(b.country));

const applied = report.reduce((n, r) => n + r.applied.length, 0);
console.error(`\n${applied} question(s) changed across ${report.filter((r) => r.applied.length).length} countries, ~$${costUsd(usage).toFixed(2)}`);
if (summaryPath)
  writeFileSync(
    summaryPath,
    renderRefreshSummary(report, `Automated Current Affairs refresh for ${today()} (model \`${MODEL}\`, ~$${costUsd(usage).toFixed(2)}).`),
  );
const resultPath = opt('--result');
if (resultPath) writeFileSync(resultPath, JSON.stringify({ changed: applied, cost_usd: costUsd(usage), report }, null, 2) + '\n');
// Partial failures still produce a PR (the summary lists them); fail only when nothing ran.
if (report.every((r) => r.error)) process.exit(1);

async function refresh(country) {
  const bank = loadBank(country);
  const qs = bank.topics['current-affairs'];
  const prompt = writerPrompt(country, qs, { fresh, today: today() });
  const run = await runToolTurns({ system: WRITER_SYSTEM, prompt, reportTool: PROPOSE_TOOL, maxSearches: 12 });
  usage = addUsage(usage, run.usage);

  const { candidates, rejected } = screenProposals(qs, run.result.changes, {
    fresh,
    bankTexts: Object.values(bank.topics).flat().map((q) => q.q),
  });

  // Independent check: a separate call that never saw the writer's searches.
  const applied = [];
  if (candidates.length) {
    const check = await checkItems(
      candidates.map((ch) => questionItem(ch.question, `new#${ch.index}`)),
      { country, topic: 'current-affairs (newly written)' },
    );
    usage = addUsage(usage, check.usage);
    const result = applyVerified(qs, candidates, check.verdicts);
    applied.push(...result.applied);
    rejected.push(...result.rejected);
  }
  if (applied.length) writeBank(country, bank);
  console.error(`  ${country}: ${applied.length} applied, ${rejected.length} rejected`);
  return { country, applied, rejected };
}
