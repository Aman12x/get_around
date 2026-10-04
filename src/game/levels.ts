export type LevelId = 'explorer' | 'voyager' | 'legend';
export type Difficulty = 1 | 2 | 3;

export interface Level {
  id: LevelId;
  label: string;
  medal: 'Bronze' | 'Silver' | 'Gold';
  icon: string;
  color: string;
  blurb: string;
  /** How many questions of each difficulty a 10-question quiz draws. */
  mix: Record<Difficulty, number>;
}

export const LEVELS: Level[] = [
  {
    id: 'explorer',
    label: 'Explorer',
    medal: 'Bronze',
    icon: '🧭',
    color: '#d08a4f',
    blurb: 'Famous names, places and moments',
    mix: { 1: 6, 2: 4, 3: 0 },
  },
  {
    id: 'voyager',
    label: 'Voyager',
    medal: 'Silver',
    icon: '⛵',
    color: '#a3b1c6',
    blurb: 'A proper test, from easy to tricky',
    mix: { 1: 3, 2: 4, 3: 3 },
  },
  {
    id: 'legend',
    label: 'Legend',
    medal: 'Gold',
    icon: '👑',
    color: '#fbbf24',
    blurb: 'For true experts only',
    mix: { 1: 0, 2: 4, 3: 6 },
  },
];

export const LEVEL_BY_ID: Record<LevelId, Level> = Object.fromEntries(LEVELS.map((l) => [l.id, l])) as Record<LevelId, Level>;

export function levelRank(id: LevelId): number {
  return LEVELS.findIndex((l) => l.id === id);
}

export function nextLevel(id: LevelId): Level | null {
  return LEVELS[levelRank(id) + 1] ?? null;
}

/** Short description of a level's difficulty mix, e.g. "6 easy · 4 medium". */
export function describeMix(level: Level): string {
  const names: Record<Difficulty, string> = { 1: 'easy', 2: 'medium', 3: 'hard' };
  return ([1, 2, 3] as Difficulty[])
    .filter((d) => level.mix[d] > 0)
    .map((d) => `${level.mix[d]} ${names[d]}`)
    .join(' · ');
}
