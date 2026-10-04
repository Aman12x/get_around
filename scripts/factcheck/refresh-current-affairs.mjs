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
import { applyVerified, screenProposals } from './refresh-core.mjs';

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

const QUESTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['q', 'choices', 'answer', 'fact', 'difficulty', 'asOf'],
  properties: {
    q: { type: 'string' },
    choices: { type: 'array', items: { type: 'string' } },
    answer: { type: 'integer', description: '0-based index of the correct choice' },
    fact: { type: 'string', description: 'At most 240 characters.' },
    difficulty: { type: 'integer', enum: [1, 2, 3] },
    asOf: { type: 'string', description: 'Four-digit year the question is true as of.' },
  },
};

const PROPOSE_TOOL = {
  name: 'propose_changes',
  description: 'Submit every proposed change to the bank. Call once, at the end. An empty list is fine.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['changes'],
    properties: {
      changes: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['index', 'kind', 'reason', 'sources', 'question'],
          properties: {
            index: { type: 'integer', description: 'Index of the existing question this replaces.' },
            kind: { type: 'string', enum: ['outdated', 'fresh'] },
            reason: { type: 'string' },
            sources: { type: 'array', items: { type: 'string' } },
            question: QUESTION_SCHEMA,
          },
        },
      },
    },
  },
};

const SYSTEM = `You maintain the Current Affairs questions for "Get Around", a travel trivia game where players fly between countries answering questions. Questions must be true, unambiguous, fun, and answerable by an interested general audience.

Rules for every question you write:
- Exactly 4 distinct, plausible choices; "answer" is the 0-based index of the single correct one. Vary which position is correct.
- "fact" (at most 240 characters) adds an interesting, verified detail; it must not just repeat the answer.
- "asOf" is the current year. Keep the difficulty of the question you replace (1 easy, 2 medium, 3 hard).
- Prefer settled facts (results, openings, appointments, records, launches) over ongoing stories whose outcome may change within weeks. No questions about deaths or tragedies framed as trivia, and no partisan framing.
- Every claim must be confirmed by web search with reputable sources (list their URLs).
- Do not duplicate a question already in the bank.`;

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
if (summaryPath) writeFileSync(summaryPath, renderSummary());
const resultPath = opt('--result');
if (resultPath) writeFileSync(resultPath, JSON.stringify({ changed: applied, cost_usd: costUsd(usage), report }, null, 2) + '\n');
// Partial failures still produce a PR (the summary lists them); fail only when nothing ran.
if (report.every((r) => r.error)) process.exit(1);

async function refresh(country) {
  const bank = loadBank(country);
  const qs = bank.topics['current-affairs'];
  const listing = qs
    .map((q, i) => `#${i} [difficulty ${q.difficulty}, asOf ${q.asOf}] ${q.q} -> ${q.choices[q.answer]}. Fact: ${q.fact}`)
    .join('\n');
  const prompt = `Today is ${today()}. Country: ${country}.

Here is the current Current Affairs bank (${qs.length} questions):
${listing}

1. Find every question that is no longer true today (changed office holders, records broken, rankings moved, events that turned out differently). For each, propose a corrected replacement at the same index ("kind": "outdated") — either the updated fact or a new question on the same theme.
2. Search the news from roughly the last two months about ${country}. Propose up to ${fresh} new questions about notable, settled developments ("kind": "fresh"), each replacing the stalest or least interesting existing question of the SAME difficulty (prefer the oldest asOf).
Each index may be used at most once. If nothing needs changing, submit an empty list.`;
  const run = await runToolTurns({ system: SYSTEM, prompt, reportTool: PROPOSE_TOOL, maxSearches: 12 });
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

function renderSummary() {
  const L = [
    `Automated Current Affairs refresh for ${today()} (model \`${MODEL}\`, ~$${costUsd(usage).toFixed(2)}).`,
    '',
    'Every change below was written with web search, passed the content schema, and was then confirmed by a separate fact-check call. **Please still read each one before merging**: check the answer key and open at least one source.',
    '',
  ];
  for (const r of report) {
    if (!r.applied.length && !r.rejected.length && !r.error) continue;
    L.push(`## ${r.country}`, '');
    if (r.error) L.push(`⚠️ Failed: ${r.error}`, '');
    for (const a of r.applied) {
      L.push(
        `**#${a.index} (${a.kind}, difficulty ${a.question.difficulty})**: ${a.reason}`,
        `- Before: ${a.before.q} → *${a.before.choices[a.before.answer]}* (asOf ${a.before.asOf})`,
        `- After: ${a.question.q} → *${a.question.choices[a.question.answer]}*`,
        `- Fact: ${a.question.fact}`,
        `- Sources: ${a.sources.join(', ') || 'none given'}`,
        '',
      );
    }
    if (r.rejected.length) {
      L.push('<details><summary>Rejected proposals</summary>', '');
      for (const x of r.rejected) L.push(`- #${x.index} ${x.question?.q ?? ''}: ${x.why}`);
      L.push('', '</details>', '');
    }
  }
  return L.join('\n') + '\n';
}
