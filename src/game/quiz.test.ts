import { describe, expect, it } from 'vitest';
import type { Question } from '../data/questions';
import { buildQuiz, isPass, requiredCorrect, sparesLeft } from './quiz';

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
});
