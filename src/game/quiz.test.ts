import { describe, expect, it } from 'vitest';
import type { Question } from '../data/questions';
import { LEVEL_BY_ID } from './levels';
import { buildQuiz, isPass, questionId, requiredCorrect, sparesLeft } from './quiz';

const q = (n: number, difficulty: 1 | 2 | 3 = 1): Question => ({
  q: `Q${n}`,
  choices: [`right${n}`, 'a', 'b', 'c'],
  answer: 0,
  fact: 'f',
  difficulty,
});

function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

/** 25 questions: 9 easy, 9 medium, 7 hard — the target bank size. */
const fullPool = [
  ...Array.from({ length: 9 }, (_, i) => q(i, 1)),
  ...Array.from({ length: 9 }, (_, i) => q(100 + i, 2)),
  ...Array.from({ length: 7 }, (_, i) => q(200 + i, 3)),
];

const counts = (qs: { difficulty: number }[]) => [1, 2, 3].map((d) => qs.filter((x) => x.difficulty === d).length);

describe('pass threshold', () => {
  it('needs 9 of 10 (90%)', () => {
    expect(requiredCorrect(10)).toBe(9);
    expect(isPass(9, 10)).toBe(true);
    expect(isPass(8, 10)).toBe(false);
    expect(isPass(0, 0)).toBe(false);
  });

  it('allows exactly one miss in a 10-question quiz', () => {
    expect(sparesLeft(0, 10)).toBe(1);
    expect(sparesLeft(1, 10)).toBe(0);
    expect(sparesLeft(2, 10)).toBe(-1);
  });
});

describe('buildQuiz', () => {
  const pool = [q(1, 3), q(2, 1), q(3, 2), q(4, 1), q(5, 3), q(6, 2), q(7, 1), q(8, 2), q(9, 3), q(10, 1), q(11, 2)];

  it('takes 10 questions ordered easy → hard', () => {
    const quiz = buildQuiz(pool, seeded(3));
    expect(quiz).toHaveLength(10);
    const diffs = quiz.map((x) => x.difficulty);
    expect(diffs).toEqual([...diffs].sort());
  });

  it('keeps the correct answer pointing at the right choice after shuffling', () => {
    for (let s = 1; s < 50; s++) {
      for (const item of buildQuiz(pool, seeded(s))) {
        expect(item.choices[item.correctIndex]).toBe(`right${item.q.slice(1)}`);
        expect(new Set(item.choices).size).toBe(4);
      }
    }
  });

  it('follows each level’s difficulty mix on a full bank', () => {
    expect(counts(buildQuiz(fullPool, seeded(1), { mix: LEVEL_BY_ID.explorer.mix }))).toEqual([6, 4, 0]);
    expect(counts(buildQuiz(fullPool, seeded(2), { mix: LEVEL_BY_ID.voyager.mix }))).toEqual([3, 4, 3]);
    expect(counts(buildQuiz(fullPool, seeded(3), { mix: LEVEL_BY_ID.legend.mix }))).toEqual([0, 4, 6]);
  });

  it('tops up from the nearest difficulty when a bank is short', () => {
    // Only 2 hard questions: Legend still gets 10, filling with medium before easy.
    const small = [...fullPool.filter((x) => x.difficulty !== 3), q(300, 3), q(301, 3)];
    const quiz = buildQuiz(small, seeded(4), { mix: LEVEL_BY_ID.legend.mix });
    expect(quiz).toHaveLength(10);
    expect(counts(quiz)).toEqual([0, 8, 2]);
  });

  it('prefers questions the player has not seen recently', () => {
    const first = buildQuiz(fullPool, seeded(5), { mix: LEVEL_BY_ID.explorer.mix });
    const seen = new Set(first.map((x) => x.id));
    const second = buildQuiz(fullPool, seeded(6), { mix: LEVEL_BY_ID.explorer.mix, seen });
    const repeats = second.filter((x) => seen.has(x.id)).length;
    // 9 easy (6 seen) → 3 fresh easy + 3 repeats; 9 medium (4 seen) → 4 fresh.
    expect(repeats).toBe(3);
  });

  it('gives every question a stable id', () => {
    expect(questionId({ q: 'Who built the pyramids?' })).toBe(questionId({ q: 'Who built the pyramids?' }));
    expect(questionId({ q: 'A' })).not.toBe(questionId({ q: 'B' }));
  });
});
