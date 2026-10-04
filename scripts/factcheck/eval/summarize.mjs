#!/usr/bin/env node
// Headline numbers for a fact-check eval run: precision, recall, specificity (with 95%
// Wilson intervals), recall per error source, cost, and every miss / false alarm.
//
//   node scripts/factcheck/eval/summarize.mjs [--flow .claude/hillclimb/factcheck] [--variant baseline]
// Writes <flow>/<variant>/summary.md and prints it.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, dflt) => (args.includes(name) ? args[args.indexOf(name) + 1] : dflt);
const flow = opt('--flow', '.claude/hillclimb/factcheck');
const variant = opt('--variant', 'baseline');
const dir = `${flow}/${variant}`;
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const rows = read(`${dir}/results.jsonl`).filter((r) => r.status === 'ok');
const errors = read(`${dir}/errors.jsonl`);
const { cases } = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8'));

const sum = (k) => rows.reduce((n, r) => n + (r.grade?.[k] ?? 0), 0);
const tp = sum('tp'), fp = sum('fp'), fn = sum('fn'), tn = sum('tn');
const cost = [...rows, ...errors].reduce((n, r) => n + (r.cost_usd ?? 0), 0);

function wilson(k, n) {
  if (!n) return 'n/a';
  const z = 1.96, p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  return `${pct(p)} (${pct(Math.max(0, c - h))}–${pct(Math.min(1, c + h))}, ${k}/${n})`;
}

// Recall per error source: parse each row's explanation for missed items.
const missedIds = new Map();
for (const r of rows)
  for (const line of String(r.explanation?.accuracy ?? '').split('\n')) {
    const m = line.match(/^missed (\S+) /);
    if (m) missedIds.set(`${r.prompt_id}/${m[1]}`, true);
  }
const scored = new Set(rows.map((r) => r.prompt_id));
const bySource = new Map();
for (const c of cases) {
  if (!scored.has(c.id)) continue;
  for (const i of c.items.filter((i) => i.label === 'flag')) {
    const s = bySource.get(i.source) ?? { n: 0, hit: 0 };
    s.n++;
    if (!missedIds.has(`${c.id}/${i.id}`)) s.hit++;
    bySource.set(i.source, s);
  }
}

const L = [
  `# Fact-check eval: ${variant}`,
  '',
  `${rows.length} of ${cases.length} packets scored${errors.length ? `, ${errors.length} failed attempt(s) in errors.jsonl` : ''}; model ${rows[0]?.model ?? 'n/a'}; cost ~$${cost.toFixed(2)}.`,
  '',
  '| Metric | Value (95% CI) |',
  '| --- | --- |',
  `| Recall (errors caught) | ${wilson(tp, tp + fn)} |`,
  `| Precision (flags that were real) | ${wilson(tp, tp + fp)} |`,
  `| Specificity (clean items passed) | ${wilson(tn, tn + fp)} |`,
  `| False-alarm rate | ${wilson(fp, tn + fp)} |`,
  `| Accuracy | ${wilson(tp + tn, tp + tn + fp + fn)} |`,
  '',
  '| Error source | Recall |',
  '| --- | --- |',
  ...[...bySource].sort().map(([s, v]) => `| ${s} | ${wilson(v.hit, v.n)} |`),
  '',
  '## Misses and false alarms',
  '',
  ...rows.flatMap((r) =>
    String(r.explanation?.accuracy ?? '')
      .split('\n')
      .filter((l) => l.startsWith('missed') || l.startsWith('false alarm'))
      .map((l) => `- **${r.prompt_id}** ${l}`),
  ),
  '',
];
const md = L.join('\n');
writeFileSync(`${dir}/summary.md`, md);
console.log(md);
if (!rows.length) process.exit(1); // nothing scored: no key, or every call failed
