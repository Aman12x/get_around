// Pure helpers for `factcheck.mjs refresh` (no model calls), unit-tested in refresh-core.test.mjs.

export function norm(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** The same rules scripts/validate-content.mjs enforces, plus "keep the difficulty". */
export function schemaProblem(q, old, texts) {
  if (typeof q?.q !== 'string' || !q.q.trim()) return 'missing question text';
  if (!Array.isArray(q.choices) || q.choices.length !== 4) return 'needs exactly 4 choices';
  if (new Set(q.choices.map((c) => String(c).trim().toLowerCase())).size !== 4) return 'duplicate choices';
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) return 'answer must be 0-3';
  if (typeof q.fact !== 'string' || !q.fact.trim() || q.fact.length > 240) return 'fact missing or over 240 characters';
  if (q.difficulty !== old.difficulty) return `difficulty ${q.difficulty} does not match replaced question (${old.difficulty})`;
  if (!/^\d{4}$/.test(q.asOf ?? '')) return 'asOf must be a year';
  if (texts.has(norm(q.q)) && norm(q.q) !== norm(old.q)) return 'duplicate of an existing question';
  return null;
}

/**
 * Screen the writer's proposals against the bank. `qs` is the current-affairs list,
 * `bankTexts` every question text in the country's bank (all topics).
 * Returns { candidates, rejected }; nothing is modified.
 */
export function screenProposals(qs, changes, { fresh, bankTexts }) {
  const rejected = [];
  const candidates = [];
  const used = new Set();
  const texts = new Set([...bankTexts].map(norm));
  let freshCount = 0;
  for (const ch of changes ?? []) {
    const old = qs[ch.index];
    let problem = null;
    if (!old) problem = `index ${ch.index} out of range`;
    else if (!['outdated', 'fresh'].includes(ch.kind)) problem = `unknown kind "${ch.kind}"`;
    else if (used.has(ch.index)) problem = `index ${ch.index} used twice`;
    else if (ch.kind === 'fresh' && freshCount >= fresh) problem = 'too many fresh questions';
    else if (!Array.isArray(ch.sources) || !ch.sources.some((u) => /^https?:\/\//.test(String(u)))) problem = 'no source URL';
    else problem = schemaProblem(ch.question, old, texts);
    if (problem) {
      rejected.push({ ...ch, why: problem });
      continue;
    }
    used.add(ch.index);
    texts.add(norm(ch.question.q));
    if (ch.kind === 'fresh') freshCount++;
    candidates.push(ch);
  }
  return { candidates, rejected };
}

/**
 * Apply candidates the fact-check marked "ok" with high confidence; mutates `qs`.
 * Keys are `new#<index>`. Anything the checker is less than sure about is dropped.
 */
export function applyVerified(qs, candidates, verdicts) {
  const applied = [];
  const rejected = [];
  for (const ch of candidates) {
    const v = verdicts.get(`new#${ch.index}`);
    if (v?.verdict !== 'ok') {
      rejected.push({ ...ch, why: `fact-check: ${v?.verdict ?? 'no verdict'}${v?.issue ? ` (${v.issue})` : ''}` });
      continue;
    }
    if (v.confidence !== 'high') {
      rejected.push({ ...ch, why: `fact-check: ok but only ${v.confidence ?? 'unstated'} confidence` });
      continue;
    }
    applied.push({ ...ch, before: qs[ch.index] });
    qs[ch.index] = {
      q: ch.question.q,
      choices: ch.question.choices,
      answer: ch.question.answer,
      fact: ch.question.fact,
      difficulty: ch.question.difficulty,
      asOf: ch.question.asOf,
    };
  }
  return { applied, rejected };
}

// ------------------------------------------------------------- writer prompt
// The brief the writer session gets, the shape its answer must take, and the PR body.

/** The dated subjects the refresh keeps current, with what "fresh" means for each. */
export const REFRESH_TOPICS = {
  'current-affairs': {
    label: 'Current Affairs',
    fresh: 'Search the news from roughly the last two months about {country}. Propose up to {fresh} new questions about notable, settled developments',
  },
  society: {
    label: 'Society & Economy',
    fresh:
      'Search for recent, well-documented social and economic developments in {country}: cost of living and inflation, housing and rents, jobs and wages, pensions, population and migration figures, poverty and inequality, welfare and subsidies, strikes over pay, energy prices and major economic policy changes. Prefer published statistics and decided policies (national statistics office, central bank, IMF/OECD/World Bank, major news organisations). Propose up to {fresh} new questions about them',
  },
};

export const QUESTION_SCHEMA = {
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

export const CHANGES_SCHEMA = {
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
};

export const WRITER_SYSTEM = `You maintain the dated question banks (Current Affairs, and Society & Economy) for "Get Around", a travel trivia game where players fly between countries answering questions. Questions must be true, unambiguous, fun, and answerable by an interested general audience.

Rules for every question you write:
- Exactly 4 distinct, plausible choices; "answer" is the 0-based index of the single correct one. Vary which position is correct.
- "fact" (at most 240 characters) adds an interesting, verified detail; it must not just repeat the answer.
- "asOf" is the current year. Keep the difficulty of the question you replace (1 easy, 2 medium, 3 hard).
- Prefer settled facts (results, openings, appointments, records, launches) over ongoing stories whose outcome may change within weeks. No questions about deaths or tragedies framed as trivia, and no partisan framing.
- Every claim must be confirmed by web search with reputable sources; list at least one source URL for each change, ideally two independent ones.
- Do not duplicate a question already in the bank.`;

export function writerPrompt(country, qs, { fresh, today, topic = 'current-affairs' }) {
  const { label, fresh: freshBrief } = REFRESH_TOPICS[topic];
  const listing = qs
    .map((q, i) => `#${i} [difficulty ${q.difficulty}, asOf ${q.asOf}] ${q.q} -> ${q.choices[q.answer]}. Fact: ${q.fact}`)
    .join('\n');
  return `Today is ${today}. Country: ${country}. Subject: ${label}.

Here is the current ${label} bank (${qs.length} questions):
${listing}

1. Find every question that is no longer true today, read exactly as written. For each, propose a corrected replacement at the same index ("kind": "outdated"): either the updated fact or a new question on the same theme.
   A question is outdated only if its question, marked answer or fact now states something false, typically present-tense claims ("is the current...", "holds the record", "is the tallest") overtaken by events, or a "will" that turned out differently.
   A dated statement about the past ("In October 2023, X set a world record in Chicago") is NOT outdated just because something changed later (the record was since broken, the person left office); it is still true as history. Do not mark it outdated. If it has merely gone stale, you may replace it as one of your "fresh" questions instead.
2. ${freshBrief.replaceAll('{country}', country).replaceAll('{fresh}', String(fresh))} ("kind": "fresh"), each replacing the stalest or least interesting existing question of the SAME difficulty (prefer the oldest asOf).
Each index may be used at most once. If nothing needs changing, submit an empty list.`;
}

/** Pull-request body listing every applied change with before/after and sources. */
export function renderRefreshSummary(report, intro) {
  const L = [
    intro,
    '',
    'Every change below was written with web search, cites at least one source, passed the content schema, and was confirmed with high confidence by a separate fact-check session. Scheduled refreshes merge automatically once the tests pass; if anything looks wrong, revert this PR or fix the question in a follow-up.',
    '',
  ];
  for (const r of report) {
    if (!r.applied.length && !r.rejected.length && !r.error) continue;
    L.push(`## ${r.country}`, '');
    if (r.error) L.push(`⚠️ Failed: ${r.error}`, '');
    for (const a of r.applied) {
      L.push(
        `**${a.topic ? `${REFRESH_TOPICS[a.topic]?.label ?? a.topic} ` : ''}#${a.index} (${a.kind}, difficulty ${a.question.difficulty})**: ${a.reason}`,
        `- Before: ${a.before.q} → *${a.before.choices[a.before.answer]}* (asOf ${a.before.asOf})`,
        `- After: ${a.question.q} → *${a.question.choices[a.question.answer]}*`,
        `- Fact: ${a.question.fact}`,
        `- Sources: ${(a.sources ?? []).join(', ') || 'none given'}`,
        '',
      );
    }
    if (r.rejected.length) {
      L.push('<details><summary>Rejected proposals</summary>', '');
      for (const x of r.rejected) L.push(`- ${x.topic ? `${REFRESH_TOPICS[x.topic]?.label ?? x.topic} ` : ''}#${x.index} ${x.question?.q ?? ''}: ${x.why}`);
      L.push('', '</details>', '');
    }
  }
  return L.join('\n') + '\n';
}
