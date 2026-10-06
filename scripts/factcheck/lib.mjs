// Shared data helpers and prompts for the content tools in scripts/factcheck/.
// No model calls happen here: everything that needs Claude goes through claude.mjs,
// which runs the Claude Code CLI on your Claude subscription (never the API).
import { readFileSync, writeFileSync } from 'node:fs';

export const ROOT = new URL('../../', import.meta.url).pathname;
export const TOPICS = ['history', 'technology', 'art', 'politics', 'current-affairs', 'society', 'general'];
/** Subjects about recent events; every question has an asOf year and the refresh keeps them current. */
export const DATED_TOPICS = ['current-affairs', 'society'];
export const VERDICTS = ['ok', 'wrong_answer', 'false_claim', 'ambiguous', 'outdated'];

export function today() {
  return process.env.FACTCHECK_TODAY || new Date().toISOString().slice(0, 10);
}

export function countryIds() {
  const src = readFileSync(`${ROOT}src/data/countries.ts`, 'utf8');
  return [...src.matchAll(/^\s{4}id: '([a-z-]+)'/gm)].map((m) => m[1]);
}

export function loadBank(country) {
  return JSON.parse(readFileSync(`${ROOT}src/data/questions/${country}.json`, 'utf8'));
}

/**
 * Write a bank back in the file's existing layout: either plain 2-space JSON or
 * 2-space JSON with each `choices` array kept on one line.
 */
export function writeBank(country, bank) {
  const path = `${ROOT}src/data/questions/${country}.json`;
  const before = readFileSync(path, 'utf8');
  const inline = /"choices": \[".*\],?\n/.test(before);
  writeFileSync(path, stringifyBank(bank, inline));
}

export function stringifyBank(bank, inlineChoices = true) {
  if (!inlineChoices) return JSON.stringify(bank, null, 2) + '\n';
  const lists = [];
  const marked = JSON.parse(JSON.stringify(bank), (k, v) => {
    if (k === 'choices' && Array.isArray(v)) return `\u0000CHOICES${lists.push(v) - 1}\u0000`;
    return v;
  });
  return (
    JSON.stringify(marked, null, 2).replace(/"\\u0000CHOICES(\d+)\\u0000"/g, (_, n) =>
      `[${lists[Number(n)].map((c) => JSON.stringify(c)).join(', ')}]`,
    ) + '\n'
  );
}

export function loadExtras(country) {
  return JSON.parse(readFileSync(`${ROOT}src/data/extras/${country}.json`, 'utf8'));
}

// ---------------------------------------------------------------- fact-check

export const VERDICTS_SCHEMA = {
  type: 'object',
  required: ['verdicts'],
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'verdict', 'confidence', 'issue', 'suggested_fix', 'source'],
        properties: {
          id: { type: 'string' },
          verdict: { type: 'string', enum: VERDICTS },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          issue: { type: 'string', description: 'What is wrong, in one sentence. Empty string when ok.' },
          suggested_fix: { type: 'string', description: 'The corrected text or answer. Empty string when ok.' },
          source: { type: 'string', description: 'URL you relied on, or "knowledge". Empty string when ok.' },
        },
      },
    },
  },
};

export const FACTCHECK_SYSTEM = `You are the fact-checker for "Get Around", a travel trivia game. Players answer multiple-choice questions about a country, then read a short "fact". A wrong answer key or a false fact teaches players something untrue, so accuracy matters more than anything else.

For each item decide:
- ok: the marked answer is correct, no other choice is also defensibly correct, and every claim in the question and fact is true.
- wrong_answer: the marked answer is not the correct one (say which choice is).
- false_claim: the answer is right but the question text or fact states something untrue (a wrong date, number, name, or an unearned "first/largest/only").
- ambiguous: more than one choice is defensibly correct, or the question depends on a definition sources disagree on.
- outdated: it was true when written (see asOf) but, read exactly as written, is no longer true today. A dated statement about the past ("In 2023, X set the record") is still true even if things changed later, so it is ok, not outdated.
Timeline items: check the year and label. Map places: check the coordinates are within about 10 km and the clue is true.

Use web search for anything you are not highly confident about, and always for current-affairs and society items or anything that could have changed recently. Do not flag stylistic issues, harmless simplifications, or claims that are standard in reputable sources. When sources genuinely disagree on a date or figure and the item picked a mainstream value, it is ok.
Give exactly one verdict for every item id.`;

export function factcheckPrompt(items, { country, topic }) {
  return `Today is ${today()}. Country: ${country}${topic ? `. Topic: ${topic}` : ''}.
Check these ${items.length} items:

${items.map(renderItem).join('\n\n')}`;
}

function renderItem(item) {
  if (item.kind === 'timeline')
    return `[${item.id}] TIMELINE EVENT: "${item.event}", dated ${item.label} (year ${item.year}${item.approx ? ', approximate' : ''})`;
  if (item.kind === 'place')
    return `[${item.id}] MAP PLACE: ${item.name} (${item.placeKind}) at lat ${item.lat}, lon ${item.lon}. Clue: "${item.clue}"`;
  const letters = 'ABCD';
  const choices = item.choices.map((c, i) => `   ${letters[i]}. ${c}${i === item.answer ? '   <- marked correct' : ''}`).join('\n');
  return `[${item.id}] QUESTION${item.asOf ? ` (written as of ${item.asOf})` : ''}: ${item.q}
${choices}
   Fact shown after answering: ${item.fact}`;
}

/** Turn a bank question into a checkable item. */
export function questionItem(q, id) {
  return { id, kind: 'question', q: q.q, choices: q.choices, answer: q.answer, fact: q.fact, asOf: q.asOf };
}
