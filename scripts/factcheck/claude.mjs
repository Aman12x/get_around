// The only way the content tools reach a model: the Claude Code CLI (`claude -p`),
// authenticated with your Claude subscription. There is no API client in this repo.
//
//   - Locally it uses your `claude` login. In CI it uses CLAUDE_CODE_OAUTH_TOKEN
//     (made with `claude setup-token`).
//   - API credentials are stripped from the CLI's environment, so even if ANTHROPIC_API_KEY
//     happens to be set, the run can't fall back to per-token API billing.
//   - Claude may read, search the web and write only inside .factcheck/; Bash is blocked.
//     If anything else in the working tree changes during a session, the run stops.
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { FACTCHECK_SYSTEM, factcheckPrompt, ROOT, VERDICTS, VERDICTS_SCHEMA } from './lib.mjs';

export const MODEL = process.env.FACTCHECK_MODEL || 'claude-sonnet-5-5';
export const WORK = `${ROOT}.factcheck`;

/** Variables that would route the CLI to the API or another provider instead of the subscription. */
export const API_ENV = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_PROFILE',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
];

export function subscriptionEnv(env = process.env) {
  const clean = { ...env };
  for (const k of API_ENV) delete clean[k];
  return clean;
}

const TOOLS = ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Edit(./.factcheck/**)'];
const BLOCKED = ['Bash', 'NotebookEdit'];

export class ClaudeError extends Error {
  constructor(message, failureClass, extra = {}) {
    super(message);
    this.failure_class = failureClass;
    Object.assign(this, extra);
  }
}

/**
 * Hash of the working tree, skipping git-ignored paths (.factcheck/ among them) and the
 * eval's own results folder, which the eval runner writes while sessions are running.
 */
function treeFingerprint() {
  const run = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const scope = ['--', '.', ':(exclude).claude/hillclimb'];
  return createHash('sha256')
    .update(run(['status', '--porcelain=v1', '--untracked-files=all', ...scope]))
    .update(run(['diff', 'HEAD', '--binary', ...scope]))
    .digest('hex');
}

/**
 * Write `task` (markdown) to .factcheck/tasks/<id>.md and have a fresh Claude Code
 * session carry it out. The session must write its result to .factcheck/out/<id>.json;
 * that file is returned parsed (it is untrusted data: callers validate it).
 */
export async function runClaudeTask(id, task, { maxTurns = 150, timeoutMs = 60 * 60 * 1000 } = {}) {
  if (process.env.CI && !process.env.CLAUDE_CODE_OAUTH_TOKEN)
    throw new ClaudeError('CLAUDE_CODE_OAUTH_TOKEN is not set (create one with `claude setup-token`)', 'auth');
  mkdirSync(`${WORK}/tasks`, { recursive: true });
  mkdirSync(`${WORK}/out`, { recursive: true });
  const outRel = `.factcheck/out/${id}.json`;
  writeFileSync(`${WORK}/tasks/${id}.md`, `${task}\n\nWrite your result to \`${outRel}\` and nothing else.\n`);

  const before = treeFingerprint();
  const args = [
    '-p', `Read .factcheck/tasks/${id}.md and carry out the task it describes. The only file you may write is ${outRel}.`,
    '--model', MODEL,
    '--max-turns', String(maxTurns),
    '--output-format', 'stream-json',
    '--verbose',
    '--allowedTools', TOOLS.join(','),
    '--disallowedTools', BLOCKED.join(','),
  ];
  const { result, transcript } = await new Promise((resolve, reject) => {
    const child = spawn('claude', args, { cwd: ROOT, env: subscriptionEnv(), stdio: ['ignore', 'pipe', 'inherit'] });
    const transcript = [{ role: 'user', content: task }];
    let result = null;
    let buf = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new ClaudeError(`${id}: no result after ${timeoutMs / 60000} minutes`, 'timeout'));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        let ev;
        try { ev = JSON.parse(line); } catch { continue; }
        if (ev.type === 'result') result = ev;
        else recordEvent(transcript, ev);
      }
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new ClaudeError(e.code === 'ENOENT' ? 'the `claude` CLI is not installed (npm install -g @anthropic-ai/claude-code)' : e.message, 'cli'));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (!result) reject(new ClaudeError(`${id}: claude exited with code ${code} and no result`, 'cli'));
      else resolve({ result, transcript });
    });
  });

  const usage = result.usage ?? {};
  const model = servedModel(result.modelUsage);
  const extra = { usage, model, transcript, list_cost_usd: result.total_cost_usd ?? 0 };
  if (treeFingerprint() !== before)
    throw new ClaudeError(`${id}: files outside .factcheck/ changed during the session; stopping`, 'sandbox', extra);
  if (result.is_error || result.subtype !== 'success')
    throw new ClaudeError(`${id}: ${result.subtype ?? 'error'}${result.result ? ` - ${String(result.result).slice(0, 300)}` : ''}`, result.subtype === 'error_max_turns' ? 'max_turns' : 'error', extra);
  let output;
  try {
    output = JSON.parse(readFileSync(`${ROOT}${outRel}`, 'utf8'));
  } catch (e) {
    throw new ClaudeError(`${id}: no valid ${outRel} (${e.code ?? e.message})`, 'no_result', extra);
  }
  return { output, ...extra };
}

/** The model that did most of the work (Claude Code may use a small model for side tasks). */
function servedModel(modelUsage = {}) {
  const entries = Object.entries(modelUsage);
  if (!entries.length) return MODEL;
  return entries.sort((a, b) => (b[1].outputTokens ?? 0) - (a[1].outputTokens ?? 0))[0][0];
}

function recordEvent(transcript, ev) {
  const content = ev.message?.content;
  if (!Array.isArray(content)) return;
  for (const b of content) {
    if (ev.type === 'assistant' && b.type === 'text' && b.text.trim()) transcript.push({ role: 'assistant', content: b.text });
    else if (ev.type === 'assistant' && b.type === 'tool_use')
      transcript.push({ role: 'tool_call', name: b.name, content: JSON.stringify(b.input, null, 2) });
    else if (ev.type === 'user' && b.type === 'tool_result') {
      const text = Array.isArray(b.content) ? b.content.map((c) => c.text ?? '').join('\n') : String(b.content ?? '');
      transcript.push({ role: 'tool_result', content: text.length > 4000 ? `${text.slice(0, 4000)}…` : text });
    }
  }
}

/**
 * Fact-check items ({ id, kind: 'question'|'timeline'|'place', ...fields }) in one session.
 * Returns { verdicts: Map(id -> verdict), usage, model, transcript, list_cost_usd }.
 * Items with no valid verdict are simply missing from the map.
 */
export async function checkItems(taskId, items, { country, topic }) {
  const task = `# Fact-check

${FACTCHECK_SYSTEM}

Your result is one JSON object matching this JSON Schema (no comments, no other text):

\`\`\`json
${JSON.stringify(VERDICTS_SCHEMA, null, 2)}
\`\`\`

${factcheckPrompt(items, { country, topic })}`;
  const run = await runClaudeTask(taskId, task);
  const ids = new Set(items.map((i) => i.id));
  const verdicts = new Map();
  for (const v of Array.isArray(run.output?.verdicts) ? run.output.verdicts : [])
    if (ids.has(v?.id) && VERDICTS.includes(v.verdict) && !verdicts.has(v.id))
      verdicts.set(v.id, { ...v, issue: String(v.issue ?? ''), suggested_fix: String(v.suggested_fix ?? ''), source: String(v.source ?? '') });
  return { ...run, verdicts };
}
