// Pure helpers for refresh-current-affairs.mjs (no API calls), unit-tested in refresh-core.test.mjs.

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
    const problem = !old
      ? `index ${ch.index} out of range`
      : used.has(ch.index)
        ? `index ${ch.index} used twice`
        : ch.kind === 'fresh' && freshCount >= fresh
          ? 'too many fresh questions'
          : schemaProblem(ch.question, old, texts);
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

/** Apply candidates whose fact-check verdict is "ok"; mutates `qs`. Keys are `new#<index>`. */
export function applyVerified(qs, candidates, verdicts) {
  const applied = [];
  const rejected = [];
  for (const ch of candidates) {
    const v = verdicts.get(`new#${ch.index}`);
    if (v?.verdict !== 'ok') {
      rejected.push({ ...ch, why: `fact-check: ${v?.verdict ?? 'no verdict'}${v?.issue ? ` (${v.issue})` : ''}` });
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
