#!/usr/bin/env node
// Fact-check question banks (and optionally timeline/map extras) with Claude + web search.
//
//   node scripts/factcheck/check.mjs japan                      # every topic for one country
//   node scripts/factcheck/check.mjs --topic current-affairs     # one topic, every country
//   node scripts/factcheck/check.mjs kenya --extras --out report # also timeline + places
//   node scripts/factcheck/check.mjs --dry-run                   # show what would be sent and the call count
//
// Writes <out>.json (every verdict) and <out>.md (flagged items only).
// Exit code 1 when an item is flagged with confidence >= --fail-on (default: never), 3 when a call failed.
import { writeFileSync } from 'node:fs';
import { checkItems, costUsd, addUsage, countryIds, loadBank, loadExtras, questionItem, TOPICS, MODEL } from './lib.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const optNames = ['--topic', '--out', '--fail-on', '--concurrency', '--effort'];
const positional = args.filter((a, i) => !a.startsWith('--') && !optNames.includes(args[i - 1]));
const countries = positional.length ? positional : countryIds();
const topics = opt('--topic') ? [opt('--topic')] : TOPICS;
const out = opt('--out', 'factcheck-report');
const failOn = opt('--fail-on'); // high | medium | low
const effort = opt('--effort', 'medium');
const concurrency = Number(opt('--concurrency', 4));

const unknown = countries.filter((c) => !countryIds().includes(c));
if (unknown.length) {
  console.error(`unknown country id(s): ${unknown.join(', ')}`);
  process.exit(2);
}

// One job = one country/topic bank (25 questions), or one country's extras.
const jobs = [];
for (const country of countries) {
  const bank = loadBank(country);
  for (const topic of topics) {
    const qs = bank.topics[topic] ?? [];
    jobs.push({ country, topic, items: qs.map((q, i) => ({ ...questionItem(q, `${topic}#${i}`), ref: { topic, index: i } })) });
  }
  if (flag('--extras')) {
    const ex = loadExtras(country);
    jobs.push({
      country,
      topic: 'timeline and map places',
      items: [
        ...ex.timeline.map((t, i) => ({ id: `timeline#${i}`, kind: 'timeline', ...t, ref: { kind: 'timeline', index: i } })),
        ...ex.places.map((p, i) => ({
          id: `place#${i}`, kind: 'place', name: p.name, placeKind: p.kind, lat: p.lat, lon: p.lon, clue: p.clue,
          ref: { kind: 'place', index: i },
        })),
      ],
    });
  }
}

const itemCount = jobs.reduce((n, j) => n + j.items.length, 0);
console.error(`${jobs.length} calls, ${itemCount} items, model ${MODEL}, effort ${effort}`);
if (flag('--dry-run')) process.exit(0);
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set');
  process.exit(2);
}

const results = [];
let usage = {};
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++];
    try {
      const run = await checkItems(job.items, { country: job.country, topic: job.topic, effort });
      usage = addUsage(usage, run.usage);
      for (const item of job.items) {
        const v = run.verdicts.get(item.id) ?? { verdict: 'unchecked', confidence: 'low', issue: 'no verdict returned' };
        results.push({ country: job.country, topic: job.topic, id: item.id, item: stripRef(item), ...v });
      }
      const flagged = job.items.filter((i) => (run.verdicts.get(i.id)?.verdict ?? 'unchecked') !== 'ok').length;
      console.error(`  ${job.country} › ${job.topic}: ${flagged} flagged ($${costUsd(run.usage).toFixed(2)})`);
    } catch (e) {
      usage = addUsage(usage, e.usage);
      console.error(`  ${job.country} › ${job.topic}: FAILED (${e.failure_class ?? 'error'}): ${e.message}`);
      for (const item of job.items)
        results.push({ country: job.country, topic: job.topic, id: item.id, item: stripRef(item), verdict: 'unchecked', confidence: 'low', issue: e.message });
    }
  }
}
const stripRef = ({ ref, ...rest }) => rest;
await Promise.all(Array.from({ length: concurrency }, worker));

const flagged = results.filter((r) => r.verdict !== 'ok');
writeFileSync(`${out}.json`, JSON.stringify({ model: MODEL, effort, usage, cost_usd: costUsd(usage), results }, null, 2) + '\n');
writeFileSync(`${out}.md`, renderMarkdown(flagged));
console.error(`\n${results.length} checked, ${flagged.length} flagged, ~$${costUsd(usage).toFixed(2)} -> ${out}.md / ${out}.json`);

const RANK = { low: 1, medium: 2, high: 3 };
const unchecked = results.filter((r) => r.verdict === 'unchecked').length;
if (unchecked) {
  console.error(`${unchecked} item(s) could not be checked (see above)`);
  process.exit(3);
}
if (failOn && flagged.some((r) => r.verdict !== 'unchecked' && RANK[r.confidence] >= RANK[failOn])) process.exit(1);

function renderMarkdown(rows) {
  if (!rows.length) return '# Fact-check\n\nNothing flagged.\n';
  const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const lines = ['# Fact-check', '', `${rows.length} item(s) flagged.`, '', '| Country | Item | Verdict | Confidence | Issue | Suggested fix | Source |', '| --- | --- | --- | --- | --- | --- | --- |'];
  for (const r of rows) {
    const what = r.item.q ?? r.item.event ?? r.item.name;
    lines.push(`| ${r.country} | ${esc(r.id)}: ${esc(what)} | ${r.verdict} | ${r.confidence} | ${esc(r.issue)} | ${esc(r.suggested_fix)} | ${esc(r.source)} |`);
  }
  return lines.join('\n') + '\n';
}
