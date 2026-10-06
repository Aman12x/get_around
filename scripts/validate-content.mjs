// Validates every question bank against the schema in src/data/questions/SCHEMA.md.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../src/data/questions/', import.meta.url).pathname;
const TOPICS = ['history', 'technology', 'art', 'politics', 'current-affairs', 'society', 'general'];
// Subjects about recent events: every question carries the year it was true as of.
const DATED = new Set(['current-affairs', 'society']);
const errors = [];
let total = 0;

// Optional country ids to check just those files: node scripts/validate-content.mjs morocco kenya
const only = process.argv.slice(2);
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json') && (!only.length || only.includes(f.replace('.json', ''))))) {
  const bank = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const where = (t, i) => `${file} › ${t} #${i + 1}`;
  if (bank.country !== file.replace('.json', '')) errors.push(`${file}: country "${bank.country}" does not match file name`);
  const seen = new Set();
  for (const t of TOPICS) {
    const qs = bank.topics?.[t];
    if (!Array.isArray(qs) || qs.length < 25) {
      errors.push(`${file} › ${t}: needs at least 25 questions (has ${qs?.length ?? 0})`);
      continue;
    }
    // Enough of each difficulty for every level's mix (Explorer 6 easy, Legend 6 hard) plus variety on retries.
    const byD = [1, 2, 3].map((d) => qs.filter((q) => q.difficulty === d).length);
    const MIN = [9, 9, 7];
    byD.forEach((n, i) => {
      if (n < MIN[i]) errors.push(`${file} › ${t}: needs at least ${MIN[i]} difficulty-${i + 1} questions (has ${n})`);
    });
    qs.forEach((q, i) => {
      total++;
      if (typeof q.q !== 'string' || !q.q.trim()) errors.push(`${where(t, i)}: missing question text`);
      if (!Array.isArray(q.choices) || q.choices.length !== 4) errors.push(`${where(t, i)}: needs exactly 4 choices`);
      else if (new Set(q.choices.map((c) => c.trim().toLowerCase())).size !== 4) errors.push(`${where(t, i)}: duplicate choices`);
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) errors.push(`${where(t, i)}: answer must be 0-3`);
      if (typeof q.fact !== 'string' || !q.fact.trim()) errors.push(`${where(t, i)}: missing fact`);
      else if (q.fact.length > 240) errors.push(`${where(t, i)}: fact too long (${q.fact.length})`);
      if (![1, 2, 3].includes(q.difficulty)) errors.push(`${where(t, i)}: difficulty must be 1, 2 or 3`);
      if (DATED.has(t) && !/^\d{4}$/.test(q.asOf ?? '')) errors.push(`${where(t, i)}: ${t} needs asOf year`);
      const key = q.q?.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seen.has(key)) errors.push(`${where(t, i)}: duplicate question`);
      seen.add(key);
    });
  }
}

if (errors.length) {
  console.error(`✘ ${errors.length} content problem(s):\n` + errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}
console.log(`✔ ${total} questions valid`);
