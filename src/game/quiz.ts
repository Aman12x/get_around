import type { Question } from '../data/questions';
import type { Difficulty } from './levels';

/** Fraction of correct answers needed to clear a country. */
export const PASS_RATIO = 0.9;
export const QUIZ_LENGTH = 10;

export interface QuizQuestion {
  id: string;
  q: string;
  choices: string[];
  correctIndex: number;
  fact: string;
  difficulty: number;
  asOf?: string;
}

export type Rng = () => number;

export interface QuizOptions {
  /** Questions per difficulty. Without it, questions are drawn at random. */
  mix?: Record<Difficulty, number>;
  /** Ids the player has seen recently; unseen questions are preferred. */
  seen?: ReadonlySet<string>;
  length?: number;
}

/** Stable id for a question, derived from its text (FNV-1a), so content files need no ids. */
export function questionId(q: Pick<Question, 'q'>): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < q.q.length; i++) {
    h ^= q.q.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickQuestions(pool: readonly Question[], rng: Rng, opts: QuizOptions): Question[] {
  const length = opts.length ?? QUIZ_LENGTH;
  const seen = opts.seen ?? new Set<string>();
  // Shuffle, then move recently seen questions to the back (stable, so order stays random).
  const fresh = (qs: Question[]) => qs.sort((a, b) => Number(seen.has(questionId(a))) - Number(seen.has(questionId(b))));
  const shuffled = fresh(shuffle(pool, rng));
  if (!opts.mix) return shuffled.slice(0, length);

  const mix = opts.mix;
  const picked: Question[] = [];
  const left: Question[] = [];
  for (const d of [1, 2, 3] as Difficulty[]) {
    const ofD = shuffled.filter((q) => q.difficulty === d);
    picked.push(...ofD.slice(0, mix[d]));
    left.push(...ofD.slice(mix[d]));
  }
  // Not enough of some difficulty: top up with the closest difficulty to the level's average.
  const avg = ([1, 2, 3] as Difficulty[]).reduce((s, d) => s + d * mix[d], 0) / Math.max(1, mix[1] + mix[2] + mix[3]);
  left.sort(
    (a, b) =>
      Number(seen.has(questionId(a))) - Number(seen.has(questionId(b))) ||
      Math.abs(a.difficulty - avg) - Math.abs(b.difficulty - avg),
  );
  return [...picked, ...left].slice(0, length);
}

/**
 * Build a quiz: pick questions for the level's difficulty mix (preferring ones the
 * player hasn't seen lately), order them easy → hard so each quiz feels like a climb,
 * and shuffle the answer choices.
 */
export function buildQuiz(pool: readonly Question[], rng: Rng = Math.random, opts: QuizOptions = {}): QuizQuestion[] {
  const picked = pickQuestions(pool, rng, opts);
  picked.sort((a, b) => a.difficulty - b.difficulty);
  return picked.map((src) => {
    const order = shuffle(
      src.choices.map((_, i) => i),
      rng,
    );
    return {
      id: questionId(src),
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
