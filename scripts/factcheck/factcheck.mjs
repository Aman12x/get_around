#!/usr/bin/env node
// Content fact-checking and the Current Affairs refresh, run by Claude Code on your
// Claude subscription (see claude.mjs; no API key is used or accepted).
//
//   node scripts/factcheck/factcheck.mjs check japan                    # every Japan subject
//   node scripts/factcheck/factcheck.mjs check --topic current-affairs  # one subject, every country
//   node scripts/factcheck/factcheck.mjs check kenya --extras           # also timeline + map places
//   node scripts/factcheck/factcheck.mjs refresh [countries...] [--fresh 2] [--summary pr.md]
//   add --dry-run to either to see how many Claude Code sessions it would start.
//
// check   - one session per country/subject (25 items); writes <out>.md (flagged items)
//           and <out>.json (every verdict). Exit 1 if anything is flagged at --fail-on
//           confidence or above, 3 if a session failed.
// refresh - per country, a writer session rewrites outdated Current Affairs questions and
//           proposes up to --fresh new ones; proposals are screened (schema, same difficulty,
//           no duplicates) and then checked by a separate session. Only "ok" changes are
//           written to src/data/questions/. Used by .github/workflows/current-affairs.yml.
import { writeFileSync } from 'node:fs';
import { checkItems, MODEL, runClaudeTask } from './claude.mjs';
import { countryIds, loadBank, loadExtras, questionItem, today, TOPICS, writeBank } from './lib.mjs';
import { applyVerified, CHANGES_SCHEMA, renderRefreshSummary, screenProposals, WRITER_SYSTEM, writerPrompt } from './refresh-core.mjs';

const [command, ...args] = process.argv.slice(2);
const OPTS = ['--topic', '--out', '--fail-on', '--concurrency', '--fresh', '--summary', '--result'];
const opt = (name, dflt) => (args.includes(name) ? args[args.indexOf(name) + 1] : dflt);
const flag = (name) => args.includes(name);
const positional = args.filter((a, i) => !a.startsWith('--') && !OPTS.includes(args[i - 1]));
const countries = positional.length ? positional : countryIds();
const concurrency = Number(opt('--concurrency', 2));
const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);

const unknown = countries.filter((c) => !countryIds().includes(c));
if (unknown.length) fail(`unknown country id(s): ${unknown.join(', ')}`);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 6) fail('--concurrency must be 1-6');

if (command === 'check') await check();
else if (command === 'refresh') await refresh();
else fail('usage: factcheck.mjs check|refresh [countries...] [options]  (see the header of this file)');

async function pool(jobs, fn) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
      while (next < jobs.length) await fn(jobs[next++]);
    }),
  );
}

// ------------------------------------------------------------------- check

async function check() {
  const topics = opt('--topic') ? [opt('--topic')] : TOPICS;
  if (topics.some((t) => !TOPICS.includes(t))) fail(`--topic must be one of ${TOPICS.join(', ')}`);
  const out = opt('--out', 'factcheck-report');
  const failOn = opt('--fail-on');
  const jobs = [];
  for (const country of countries) {
    const bank = loadBank(country);
    for (const topic of topics)
      jobs.push({ country, topic, items: bank.topics[topic].map((q, i) => questionItem(q, `${topic}#${i}`)) });
    if (flag('--extras')) {
      const ex = loadExtras(country);
      jobs.push({
        country,
        topic: 'timeline and map places',
        items: [
          ...ex.timeline.map((t, i) => ({ id: `timeline#${i}`, kind: 'timeline', event: t.event, year: t.year, label: t.label, approx: t.approx })),
          ...ex.places.map((p, i) => ({ id: `place#${i}`, kind: 'place', name: p.name, placeKind: p.kind, lat: p.lat, lon: p.lon, clue: p.clue })),
        ],
      });
    }
  }
  console.error(`${jobs.length} Claude Code session(s), ${jobs.reduce((n, j) => n + j.items.length, 0)} items, ${MODEL}, on your Claude subscription`);
  if (flag('--dry-run')) return;

  const results = [];
  let listCost = 0;
  await pool(jobs, async (job) => {
    const id = `check-${stamp}-${job.country}-${job.topic.split(' ')[0]}`;
    try {
      const run = await checkItems(id, job.items, { country: job.country, topic: job.topic });
      listCost += run.list_cost_usd;
      for (const item of job.items)
        results.push({ country: job.country, topic: job.topic, id: item.id, item, ...(run.verdicts.get(item.id) ?? { verdict: 'unchecked', confidence: 'low', issue: 'no verdict returned' }) });
      console.error(`  ${job.country} › ${job.topic}: ${job.items.filter((i) => run.verdicts.get(i.id)?.verdict !== 'ok').length} flagged`);
    } catch (e) {
      listCost += e.list_cost_usd ?? 0;
      console.error(`  ${job.country} › ${job.topic}: FAILED (${e.failure_class ?? 'error'}): ${e.message}`);
      for (const item of job.items) results.push({ country: job.country, topic: job.topic, id: item.id, item, verdict: 'unchecked', confidence: 'low', issue: e.message });
    }
  });

  const flagged = results.filter((r) => r.verdict !== 'ok');
  writeFileSync(`${out}.json`, JSON.stringify({ model: MODEL, list_cost_usd: listCost, results }, null, 2) + '\n');
  writeFileSync(`${out}.md`, renderCheck(flagged));
  console.error(`\n${results.length} checked, ${flagged.length} flagged -> ${out}.md / ${out}.json`);
  const unchecked = results.filter((r) => r.verdict === 'unchecked').length;
  if (unchecked) {
    console.error(`${unchecked} item(s) could not be checked`);
    process.exit(3);
  }
  const RANK = { low: 1, medium: 2, high: 3 };
  if (failOn && flagged.some((r) => RANK[r.confidence] >= RANK[failOn])) process.exit(1);
}

function renderCheck(rows) {
  if (!rows.length) return '# Fact-check\n\nNothing flagged.\n';
  const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return [
    '# Fact-check',
    '',
    `${rows.length} item(s) flagged.`,
    '',
    '| Country | Item | Verdict | Confidence | Issue | Suggested fix | Source |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((r) => `| ${r.country} | ${esc(r.id)}: ${esc(r.item.q ?? r.item.event ?? r.item.name)} | ${r.verdict} | ${r.confidence} | ${esc(r.issue)} | ${esc(r.suggested_fix)} | ${esc(r.source)} |`),
    '',
  ].join('\n');
}

// ----------------------------------------------------------------- refresh

async function refresh() {
  const fresh = Number(opt('--fresh', 2));
  if (!Number.isInteger(fresh) || fresh < 0 || fresh > 5) fail('--fresh must be a whole number from 0 to 5');
  console.error(`${countries.length} countries × (1 writer + 1 fact-check session), up to ${fresh} fresh questions each, ${MODEL}, on your Claude subscription`);
  if (flag('--dry-run')) return;

  const report = [];
  await pool(countries, async (country) => {
    try {
      report.push(await refreshCountry(country, fresh));
    } catch (e) {
      console.error(`  ${country}: FAILED (${e.failure_class ?? 'error'}): ${e.message}`);
      report.push({ country, error: e.message, applied: [], rejected: [] });
    }
  });
  report.sort((a, b) => countries.indexOf(a.country) - countries.indexOf(b.country));

  // Banks are written only now, after every Claude session has finished.
  for (const r of report) if (r.bank && r.applied.length) writeBank(r.country, r.bank);
  const changed = report.reduce((n, r) => n + r.applied.length, 0);
  console.error(`\n${changed} question(s) changed across ${report.filter((r) => r.applied.length).length} countries`);
  if (opt('--summary'))
    writeFileSync(opt('--summary'), renderRefreshSummary(report, `Automated Current Affairs refresh for ${today()}, written and checked by Claude Code (\`${MODEL}\`) on a Claude subscription.`));
  if (opt('--result')) writeFileSync(opt('--result'), JSON.stringify(report.map(({ bank, ...r }) => r), null, 2) + '\n');
  if (report.every((r) => r.error)) process.exit(1);
}

async function refreshCountry(country, fresh) {
  const bank = loadBank(country);
  const qs = bank.topics['current-affairs'];
  const task = `# Current Affairs refresh

${WRITER_SYSTEM}

${writerPrompt(country, qs, { fresh, today: today() })}

Your result is one JSON object matching this JSON Schema (no comments, no other text):

\`\`\`json
${JSON.stringify(CHANGES_SCHEMA, null, 2)}
\`\`\``;
  const writer = await runClaudeTask(`write-${stamp}-${country}`, task);
  const changes = Array.isArray(writer.output?.changes) ? writer.output.changes : [];
  const { candidates, rejected } = screenProposals(qs, changes, { fresh, bankTexts: Object.values(bank.topics).flat().map((q) => q.q) });

  const applied = [];
  if (candidates.length) {
    // A separate session that never saw the writer's searches or reasoning.
    const check = await checkItems(
      `verify-${stamp}-${country}`,
      candidates.map((ch) => questionItem(ch.question, `new#${ch.index}`)),
      { country, topic: 'current-affairs (newly written)' },
    );
    const result = applyVerified(qs, candidates, check.verdicts);
    applied.push(...result.applied);
    rejected.push(...result.rejected);
  }
  console.error(`  ${country}: ${applied.length} applied, ${rejected.length} rejected`);
  return { country, bank, applied, rejected };
}

function fail(message) {
  console.error(message);
  process.exit(2);
}
