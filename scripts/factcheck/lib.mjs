// Shared Claude plumbing for the content tools in scripts/factcheck/:
// the fact-checker (check.mjs), its eval (eval/run-eval.mjs) and the
// current-affairs refresher (refresh-current-affairs.mjs).
//
// Every call goes through `runToolTurns`, which:
//   - uses the server-side web_search tool so claims about recent events are checked live,
//   - ends when the model calls one client "report" tool whose strict JSON schema
//     is the result (so there is no free-text parsing),
//   - resumes `pause_turn`, treats `refusal` and `max_tokens` as failures,
//   - opts into server-side refusal fallbacks (`fallbacks: "default"`).
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'node:fs';

export const MODEL = process.env.FACTCHECK_MODEL || 'claude-opus-5-5';
export const ROOT = new URL('../../', import.meta.url).pathname;
export const TOPICS = ['history', 'technology', 'art', 'politics', 'current-affairs', 'general'];
export const VERDICTS = ['ok', 'wrong_answer', 'false_claim', 'ambiguous', 'outdated'];
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/** USD per million tokens / per search (Claude API list prices). */
const PRICES = {
  'claude-opus-5-5': { in: 4, out: 20, cacheRead: 0.2, cacheWrite: 5 },
};
const SEARCH_USD = 10 / 1000;

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

/** Sum two `usage` objects (only the fields we price). */
export function addUsage(a = {}, b = {}) {
  return {
    input_tokens: (a.input_tokens ?? 0) + (b.input_tokens ?? 0),
    output_tokens: (a.output_tokens ?? 0) + (b.output_tokens ?? 0),
    cache_read_input_tokens: (a.cache_read_input_tokens ?? 0) + (b.cache_read_input_tokens ?? 0),
    cache_creation_input_tokens: (a.cache_creation_input_tokens ?? 0) + (b.cache_creation_input_tokens ?? 0),
    web_search_requests:
      (a.web_search_requests ?? 0) + (b.web_search_requests ?? b.server_tool_use?.web_search_requests ?? 0),
  };
}

export function costUsd(usage, model = MODEL) {
  const p = PRICES[model] ?? PRICES['claude-opus-5-5'];
  if (!usage) return 0;
  return (
    ((usage.input_tokens ?? 0) * p.in +
      (usage.output_tokens ?? 0) * p.out +
      (usage.cache_read_input_tokens ?? 0) * p.cacheRead +
      (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite) /
      1e6 +
    (usage.web_search_requests ?? 0) * SEARCH_USD
  );
}

let client;
function getClient() {
  client ??= new Anthropic({ maxRetries: 4 });
  return client;
}

export class ToolTurnError extends Error {
  constructor(message, failureClass, extra = {}) {
    super(message);
    this.failure_class = failureClass;
    Object.assign(this, extra);
  }
}

/**
 * Run a conversation until the model calls `reportTool`. Returns the tool's input
 * plus usage, the served model and a transcript in the eval report's Turn[] shape.
 */
export async function runToolTurns({ system, prompt, reportTool, maxSearches = 8, effort = 'medium', maxTurns = 8 }) {
  const messages = [{ role: 'user', content: prompt }];
  const transcript = [{ role: 'system', content: system }, { role: 'user', content: prompt }];
  let usage = {};
  let model = MODEL;
  for (let turn = 0; turn < maxTurns; turn++) {
    const res = await getClient()
      .beta.messages.stream({
        model: MODEL,
        max_tokens: 32000,
        system,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: maxSearches }, reportTool],
        messages,
        output_config: { effort },
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
      })
      .finalMessage();
    usage = addUsage(usage, res.usage);
    model = res.model;
    recordTurn(transcript, res.content);
    if (res.stop_reason === 'refusal') throw new ToolTurnError('model refused', 'refusal', { usage, model });
    if (res.stop_reason === 'max_tokens') throw new ToolTurnError('hit max_tokens', 'truncated', { usage, model });
    const call = res.content.find((b) => b.type === 'tool_use' && b.name === reportTool.name);
    if (call) return { result: call.input, usage, model, stop_reason: res.stop_reason, transcript };
    messages.push({ role: 'assistant', content: res.content });
    // pause_turn: a long server-tool turn; re-send to let it continue.
    if (res.stop_reason !== 'pause_turn') {
      messages.push({ role: 'user', content: `Now call ${reportTool.name} with your complete result.` });
      transcript.push({ role: 'user', content: `Now call ${reportTool.name} with your complete result.` });
    }
  }
  throw new ToolTurnError(`no ${reportTool.name} call after ${maxTurns} turns`, 'no_result', { usage, model });
}

function recordTurn(transcript, content) {
  for (const b of content) {
    if (b.type === 'text' && b.text.trim()) transcript.push({ role: 'assistant', content: b.text });
    else if (b.type === 'server_tool_use' || b.type === 'tool_use')
      transcript.push({ role: 'tool_call', name: b.name, content: JSON.stringify(b.input, null, 2) });
    else if (b.type === 'web_search_tool_result') {
      const r = Array.isArray(b.content)
        ? b.content.map((x) => `${x.title} - ${x.url}`).join('\n')
        : `error: ${b.content?.error_code ?? 'unknown'}`;
      transcript.push({ role: 'tool_result', content: r });
    }
  }
}

// ---------------------------------------------------------------- fact-check

export const VERDICT_TOOL = {
  name: 'report_verdicts',
  description: 'Submit exactly one verdict for every item you were asked to check. Call this once, at the end.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['verdicts'],
    properties: {
      verdicts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
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
  },
};

export const FACTCHECK_SYSTEM = `You are the fact-checker for "Get Around", a travel trivia game. Players answer multiple-choice questions about a country, then read a short "fact". A wrong answer key or a false fact teaches players something untrue, so accuracy matters more than anything else.

For each item decide:
- ok: the marked answer is correct, no other choice is also defensibly correct, and every claim in the question and fact is true.
- wrong_answer: the marked answer is not the correct one (say which choice is).
- false_claim: the answer is right but the question text or fact states something untrue (a wrong date, number, name, or an unearned "first/largest/only").
- ambiguous: more than one choice is defensibly correct, or the question depends on a definition sources disagree on.
- outdated: it was true when written (see asOf) but is no longer true as of today.
Timeline items: check the year and label. Map places: check the coordinates are within about 10 km and the clue is true.

Use web search for anything you are not highly confident about, and always for current-affairs items or anything that could have changed recently. Do not flag stylistic issues, harmless simplifications, or claims that are standard in reputable sources. When sources genuinely disagree on a date or figure and the item picked a mainstream value, it is ok.
When finished, call report_verdicts once with a verdict for every item id.`;

/**
 * Fact-check a list of items. Each item: { id, kind: 'question'|'timeline'|'place', ...fields }.
 * Returns { verdicts: Map(id -> verdict), usage, model, transcript }.
 */
export async function checkItems(items, { country, topic, effort = 'medium', maxSearches = 8 } = {}) {
  const prompt = factcheckPrompt(items, { country, topic });
  const run = await runToolTurns({ system: FACTCHECK_SYSTEM, prompt, reportTool: VERDICT_TOOL, effort, maxSearches });
  const verdicts = new Map();
  for (const v of run.result.verdicts ?? []) if (items.some((i) => i.id === v.id)) verdicts.set(v.id, v);
  return { ...run, verdicts };
}

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
