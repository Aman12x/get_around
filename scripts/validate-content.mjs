// Validates every question bank against the schema in src/data/questions/SCHEMA.md.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../src/data/questions/', import.meta.url).pathname;
const TOPICS = ['history', 'technology', 'art', 'politics', 'current-affairs', 'general'];
const errors = [];
let total = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const bank = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const where = (t, i) => `${file} › ${t} #${i + 1}`;
  if (bank.country !== file.replace('.json', '')) errors.push(`${file}: country "${bank.country}" does not match file name`);
  const seen = new Set();
  for (const t of TOPICS) {
    const qs = bank.topics?.[t];
    if (!Array.isArray(qs) || qs.length < 10) {
      errors.push(`${file} › ${t}: needs at least 10 questions (has ${qs?.length ?? 0})`);
      continue;
    }
    qs.forEach((q, i) => {
      total++;
      if (typeof q.q !== 'string' || !q.q.trim()) errors.push(`${where(t, i)}: missing question text`);
      if (!Array.isArray(q.choices) || q.choices.length !== 4) errors.push(`${where(t, i)}: needs exactly 4 choices`);
      else if (new Set(q.choices.map((c) => c.trim().toLowerCase())).size !== 4) errors.push(`${where(t, i)}: duplicate choices`);
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) errors.push(`${where(t, i)}: answer must be 0-3`);
      if (typeof q.fact !== 'string' || !q.fact.trim()) errors.push(`${where(t, i)}: missing fact`);
      else if (q.fact.length > 240) errors.push(`${where(t, i)}: fact too long (${q.fact.length})`);
      if (![1, 2, 3].includes(q.difficulty)) errors.push(`${where(t, i)}: difficulty must be 1, 2 or 3`);
      if (t === 'current-affairs' && !/^\d{4}$/.test(q.asOf ?? '')) errors.push(`${where(t, i)}: current-affairs needs asOf year`);
      const key = q.q?.trim().toLowerCase();
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
