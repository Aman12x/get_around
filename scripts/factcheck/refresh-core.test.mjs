import { describe, expect, it } from 'vitest';
import { applyVerified, screenProposals } from './refresh-core.mjs';
import { stringifyBank } from './lib.mjs';

const q = (text, difficulty = 1, extra = {}) => ({
  q: text,
  choices: ['A', 'B', 'C', 'D'],
  answer: 0,
  fact: 'A fact.',
  difficulty,
  asOf: '2024',
  ...extra,
});

describe('screenProposals', () => {
  const qs = [q('Old one?'), q('Old two?', 2), q('Old three?', 3)];
  const opts = { fresh: 1, bankTexts: [...qs.map((x) => x.q), 'History question?'] };

  it('accepts a valid replacement at the same difficulty', () => {
    const { candidates, rejected } = screenProposals(
      qs,
      [{ index: 1, kind: 'fresh', reason: '', sources: [], question: q('New two?', 2, { asOf: '2026' }) }],
      opts,
    );
    expect(candidates).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it('rejects difficulty changes, bad schema, duplicates, reused indexes and extra fresh questions', () => {
    const { candidates, rejected } = screenProposals(
      qs,
      [
        { index: 0, kind: 'outdated', reason: '', sources: [], question: q('Changed difficulty?', 2) },
        { index: 9, kind: 'outdated', reason: '', sources: [], question: q('Out of range?') },
        { index: 1, kind: 'fresh', reason: '', sources: [], question: q('History question?', 2) },
        { index: 1, kind: 'fresh', reason: '', sources: [], question: q('Fine?', 2) },
        { index: 1, kind: 'fresh', reason: '', sources: [], question: q('Reused?', 2) },
        { index: 2, kind: 'fresh', reason: '', sources: [], question: q('Second fresh?', 3) },
        { index: 0, kind: 'outdated', reason: '', sources: [], question: q('Two same choices?', 1, { choices: ['A', 'a', 'B', 'C'] }) },
        { index: 0, kind: 'outdated', reason: '', sources: [], question: q('Long fact?', 1, { fact: 'x'.repeat(241) }) },
        { index: 0, kind: 'rewrite', reason: '', sources: [], question: q('Bad kind?') },
      ],
      opts,
    );
    expect(candidates.map((c) => c.question.q)).toEqual(['Fine?']);
    expect(rejected.map((r) => r.why)).toEqual([
      'difficulty 2 does not match replaced question (1)',
      'index 9 out of range',
      'duplicate of an existing question',
      'index 1 used twice',
      'too many fresh questions',
      'duplicate choices',
      'fact missing or over 240 characters',
      'unknown kind "rewrite"',
    ]);
  });
});

describe('applyVerified', () => {
  it('applies only items the fact-check passed, keeping the schema fields', () => {
    const qs = [q('Old one?'), q('Old two?')];
    const candidates = [
      { index: 0, kind: 'outdated', question: { ...q('New one?'), extra: 'dropped' } },
      { index: 1, kind: 'fresh', question: q('New two?') },
    ];
    const verdicts = new Map([
      ['new#0', { verdict: 'ok' }],
      ['new#1', { verdict: 'false_claim', issue: 'wrong year' }],
    ]);
    const { applied, rejected } = applyVerified(qs, candidates, verdicts);
    expect(applied.map((a) => a.before.q)).toEqual(['Old one?']);
    expect(rejected[0].why).toBe('fact-check: false_claim (wrong year)');
    expect(qs[0]).toEqual(q('New one?'));
    expect(qs[1].q).toBe('Old two?');
  });
});

describe('stringifyBank', () => {
  it('keeps choices on one line when asked', () => {
    const out = stringifyBank({ country: 'x', topics: { history: [q('Q?')] } }, true);
    expect(out).toContain('"choices": ["A", "B", "C", "D"],');
    expect(JSON.parse(out).topics.history[0].choices).toEqual(['A', 'B', 'C', 'D']);
  });
});
