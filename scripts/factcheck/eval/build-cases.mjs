#!/usr/bin/env node
// Builds the fact-checker eval set: scripts/factcheck/eval/cases.json (+ cases.md to review).
//
// One case = one "packet" of items checked in a single call, exactly how check.mjs
// sends a bank. Each item is labelled `ok` or `flag`:
//   - real errors:   items the October 2026 verification pass found and fixed
//                    (known-errors.json holds their original, wrong versions)
//   - seeded errors: correct questions mutated in ways only real knowledge catches
//       swap_answer   the answer key points at a distractor (only when the fact doesn't name the answer)
//       shift_year    a year moved 5-20 years everywhere it appears (question, choices, fact)
//       fact_number   one number in the fact scaled (e.g. 5,000 -> 10,000)
//       timeline_year a timeline event's year and label moved together
//   - clean items:   the rest of the bank as it stands after the verification pass
//
//   node scripts/factcheck/eval/build-cases.mjs [--seed 7]
import { readFileSync, writeFileSync } from 'node:fs';
import { countryIds, loadBank, loadExtras, TOPICS } from '../lib.mjs';

const here = new URL('./', import.meta.url).pathname;
const seedArg = process.argv.indexOf('--seed');
const SEED = seedArg >= 0 ? Number(process.argv[seedArg + 1]) : 7;
const PACKET = 10;
const SEEDED_PER_PACKET = 3;

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const clone = (x) => JSON.parse(JSON.stringify(x));

// ------------------------------------------------------------------ mutations

function swapAnswer(q) {
  const right = q.choices[q.answer];
  if (right.length < 3 || q.fact.toLowerCase().includes(right.toLowerCase())) return null;
  const j = pick([0, 1, 2, 3].filter((i) => i !== q.answer));
  return { item: { ...clone(q), answer: j }, note: `answer key moved from "${right}" to "${q.choices[j]}"` };
}

const YEAR = /\b(1[0-9]{3}|20[0-2][0-9])\b/g;
function shiftYear(q) {
  const pool = `${q.q} ${q.choices[q.answer]} ${q.fact}`;
  const years = [...new Set(pool.match(YEAR) ?? [])];
  if (!years.length) return null;
  const y = pick(years);
  const delta = (5 + Math.floor(rand() * 16)) * (rand() < 0.5 ? -1 : 1);
  const ny = String(Number(y) + delta);
  if (Number(ny) > 2025 || JSON.stringify(q).includes(ny)) return null;
  const re = new RegExp(`\\b${y}\\b`, 'g');
  const item = clone(q);
  item.q = item.q.replace(re, ny);
  item.choices = item.choices.map((c) => c.replace(re, ny));
  item.fact = item.fact.replace(re, ny);
  if (new Set(item.choices).size !== 4) return null;
  return { item, note: `year ${y} changed to ${ny}` };
}

const NUM = /\b\d{1,3}(?:,\d{3})+\b|\b\d+(?:\.\d+)?\b/g;
function factNumber(q) {
  const nums = [...q.fact.matchAll(NUM)]
    .map((m) => ({ text: m[0], at: m.index, value: Number(m[0].replace(/,/g, '')) }))
    .filter((n) => n.value >= 3 && !(n.value >= 1000 && n.value <= 2099 && !n.text.includes(',')))
    .filter((n) => !`${q.q} ${q.choices.join(' ')}`.includes(n.text));
  if (!nums.length) return null;
  const n = pick(nums);
  const factor = pick([0.5, 2, 3]);
  let v = n.value * factor;
  v = n.text.includes('.') ? Number(v.toFixed(1)) : Math.round(v);
  if (v === n.value) return null;
  const text = n.text.includes(',') ? v.toLocaleString('en-US') : String(v);
  const item = clone(q);
  item.fact = q.fact.slice(0, n.at) + text + q.fact.slice(n.at + n.text.length);
  return { item, note: `fact number ${n.text} changed to ${text}` };
}

function timelineYear(t) {
  const delta = (t.year < 0 ? 60 + Math.floor(rand() * 200) : 6 + Math.floor(rand() * 25)) * (rand() < 0.5 ? -1 : 1);
  const ny = t.year + delta;
  if (ny > 2025 || ny === 0) return null;
  const from = String(Math.abs(t.year));
  const to = String(Math.abs(ny));
  if (!t.label.includes(from) || Math.sign(ny) !== Math.sign(t.year)) return null;
  return { item: { ...clone(t), year: ny, label: t.label.replace(from, to) }, note: `year ${t.label} changed to ${t.label.replace(from, to)}` };
}

const MUTATIONS = { swap_answer: swapAnswer, shift_year: shiftYear, fact_number: factNumber };

// ------------------------------------------------------------------ packets

const asQuestion = (q, id) => ({ id, kind: 'question', q: q.q, choices: q.choices, answer: q.answer, fact: q.fact, ...(q.asOf ? { asOf: q.asOf } : {}) });
const asTimeline = (t, id) => ({ id, kind: 'timeline', event: t.event, year: t.year, label: t.label, ...(t.approx ? { approx: true } : {}) });
const asPlace = (p, id) => ({ id, kind: 'place', name: p.name, placeKind: p.kind, lat: p.lat, lon: p.lon, clue: p.clue });

const known = JSON.parse(readFileSync(`${here}known-errors.json`, 'utf8'));
const cases = [];

function questionPacket(country, topic, realErrors = []) {
  const bank = loadBank(country).topics[topic];
  const realIdx = new Set(realErrors.map((e) => e.index));
  const order = shuffle(bank.map((_, i) => i).filter((i) => !realIdx.has(i)));
  const chosen = order.slice(0, PACKET - realErrors.length);
  // One of each mutation kind where the packet allows it (swap_answer fits almost
  // anything, so it only fills slots the others couldn't).
  const mutated = new Map();
  const attempts = ['shift_year', 'fact_number', 'swap_answer', 'swap_answer', 'swap_answer'];
  for (const k of attempts) {
    if (mutated.size >= SEEDED_PER_PACKET) break;
    for (const i of chosen) {
      if (mutated.has(i)) continue;
      const m = MUTATIONS[k](bank[i]);
      if (m) { mutated.set(i, { ...m, kind: k }); break; }
    }
  }
  const items = chosen.map((i) => {
    const id = `${topic}#${i}`;
    const m = mutated.get(i);
    return m
      ? { ...asQuestion(m.item, id), label: 'flag', source: `seeded:${m.kind}`, note: m.note }
      : { ...asQuestion(bank[i], id), label: 'ok', source: 'clean' };
  });
  for (const e of realErrors)
    items.push({ ...asQuestion(e.before, `${topic}#${e.index}`), label: 'flag', source: `real:${e.severity}`, note: e.reason });
  return shuffle(items);
}

function extrasPacket(country, realErrors = []) {
  const ex = loadExtras(country);
  const realT = new Set(realErrors.filter((e) => e.kind === 'timeline').map((e) => e.index));
  const realP = new Set(realErrors.filter((e) => e.kind === 'place').map((e) => e.index));
  const items = [];
  let seeded = 0;
  for (const i of shuffle(ex.timeline.map((_, i) => i).filter((i) => !realT.has(i))).slice(0, 6)) {
    const m = seeded < 2 ? timelineYear(ex.timeline[i]) : null;
    if (m) {
      seeded++;
      items.push({ ...asTimeline(m.item, `timeline#${i}`), label: 'flag', source: 'seeded:timeline_year', note: m.note });
    } else items.push({ ...asTimeline(ex.timeline[i], `timeline#${i}`), label: 'ok', source: 'clean' });
  }
  for (const i of shuffle(ex.places.map((_, i) => i).filter((i) => !realP.has(i))).slice(0, 4))
    items.push({ ...asPlace(ex.places[i], `place#${i}`), label: 'ok', source: 'clean' });
  for (const e of realErrors) {
    const make = e.kind === 'timeline' ? asTimeline : asPlace;
    items.push({ ...make(e.before, `${e.kind}#${e.index}`), label: 'flag', source: `real:${e.severity}`, note: e.reason });
  }
  return shuffle(items);
}

// One question packet per country, rotating topics so every topic is covered;
// any country/topic with real errors gets its own packet carrying them.
const ids = countryIds();
ids.forEach((country, n) => {
  const topic = TOPICS[n % TOPICS.length];
  const real = known.filter((e) => e.country === country && e.kind === 'question' && e.topic === topic);
  cases.push({ id: `${country}-${topic}`, country, topic, items: questionPacket(country, topic, real) });
});
const realGroups = new Map();
for (const e of known) {
  const key = e.kind === 'question' ? `${e.country}-${e.topic}` : `${e.country}-extras`;
  if (cases.some((c) => c.id === key)) continue;
  realGroups.set(key, [...(realGroups.get(key) ?? []), e]);
}
for (const [key, errs] of realGroups) {
  const { country, topic, kind } = errs[0];
  cases.push(
    kind === 'question'
      ? { id: key, country, topic, items: questionPacket(country, topic, errs) }
      : { id: key, country, topic: 'timeline and map places', items: extrasPacket(country, errs) },
  );
}
// Two extras packets with seeded errors only, so timelines/places are measured even without real errors.
for (const country of ['egypt', 'japan'].filter((c) => !realGroups.has(`${c}-extras`)))
  cases.push({ id: `${country}-extras`, country, topic: 'timeline and map places', items: extrasPacket(country) });

cases.forEach((c) => { c.prompt = `${c.country} › ${c.topic} (${c.items.length} items, ${c.items.filter((i) => i.label === 'flag').length} with errors)`; });
writeFileSync(`${here}cases.json`, JSON.stringify({ seed: SEED, cases }, null, 2) + '\n');

// Human-readable review copy.
const all = cases.flatMap((c) => c.items.map((i) => ({ ...i, case: c.id })));
const count = (f) => all.filter(f).length;
const L = [
  '# Fact-check eval cases',
  '',
  `Generated by \`build-cases.mjs --seed ${SEED}\`. ${cases.length} packets, ${all.length} items: ` +
    `${count((i) => i.label === 'flag')} with errors (${count((i) => i.source.startsWith('real'))} real, ${count((i) => i.source.startsWith('seeded'))} seeded) and ${count((i) => i.label === 'ok')} clean.`,
  '',
  '| Source | Items |',
  '| --- | --- |',
  ...[...new Set(all.map((i) => i.source))].sort().map((s) => `| ${s} | ${count((i) => i.source === s)} |`),
  '',
  '## Every item with an error',
  '',
  '| Case | Item | Source | What is wrong |',
  '| --- | --- | --- | --- |',
  ...all
    .filter((i) => i.label === 'flag')
    .map((i) => `| ${i.case} | ${(i.q ?? i.event ?? i.name).replace(/\|/g, '\\|')} | ${i.source} | ${String(i.note).replace(/\|/g, '\\|')} |`),
  '',
];
writeFileSync(`${here}cases.md`, L.join('\n'));
console.error(L[2]);
