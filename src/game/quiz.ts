import type { Question } from '../data/questions';

/** Fraction of correct answers needed to clear a country. */
export const PASS_RATIO = 0.9;
export const QUIZ_LENGTH = 10;

export interface QuizQuestion {
  q: string;
  choices: string[];
  correctIndex: number;
  fact: string;
  difficulty: number;
  asOf?: string;
}

export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build a quiz: pick up to QUIZ_LENGTH questions, order them easy → hard so each
 * country feels like a climb, and shuffle the answer choices.
 */
export function buildQuiz(pool: readonly Question[], rng: Rng = Math.random, length = QUIZ_LENGTH): QuizQuestion[] {
  const picked = shuffle(pool, rng).slice(0, length);
  picked.sort((a, b) => a.difficulty - b.difficulty);
  return picked.map((src) => {
    const order = shuffle(
      src.choices.map((_, i) => i),
      rng,
    );
    return {
      q: src.q,
      choices: order.map((i) => src.choices[i]),
      correctIndex: order.indexOf(src.answer),
      fact: src.fact,
      difficulty: src.difficulty,
      asOf: src.asOf,
    };
  });
}

export function requiredCorrect(total: number): number {
  return Math.ceil(total * PASS_RATIO - 1e-9);
}

export function isPass(correct: number, total: number): boolean {
  return total > 0 && correct >= requiredCorrect(total);
}

/** How many more misses the player can afford before the 90% target is out of reach. */
export function sparesLeft(wrong: number, total: number): number {
  return total - requiredCorrect(total) - wrong;
}
