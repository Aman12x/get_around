import type { CountryId } from '../data/countries';
import type { Route } from '../data/routes';
import type { TopicId } from '../data/topics';
import { isPass, QUIZ_LENGTH } from './quiz';

/** Best score (correct answers out of QUIZ_LENGTH) per topic. */
export type TopicScores = Partial<Record<TopicId, number>>;

export interface Journey {
  routeId: string;
  /** Countries landed in, in order. The last entry is the current location. */
  path: CountryId[];
  scores: Partial<Record<CountryId, TopicScores>>;
  completed: boolean;
}

export interface SaveData {
  version: 1;
  traveler: { name: string; interests: TopicId[] } | null;
  activeRouteId: string | null;
  journeys: Record<string, Journey>;
  muted: boolean;
}

export function emptySave(): SaveData {
  return { version: 1, traveler: null, activeRouteId: null, journeys: {}, muted: false };
}

export function newJourney(routeId: string): Journey {
  return { routeId, path: [], scores: {}, completed: false };
}

export function currentCountry(j: Journey): CountryId | null {
  return j.path.length ? j.path[j.path.length - 1] : null;
}

export function hasCleared(j: Journey, country: CountryId): boolean {
  const scores = j.scores[country];
  if (!scores) return false;
  return Object.values(scores).some((s) => isPass(s ?? 0, QUIZ_LENGTH));
}

export function clearedTopics(j: Journey, country: CountryId): TopicId[] {
  const scores = j.scores[country] ?? {};
  return (Object.keys(scores) as TopicId[]).filter((t) => isPass(scores[t] ?? 0, QUIZ_LENGTH));
}

/** Countries the traveler may fly to right now. */
export function destinations(j: Journey, route: Route): CountryId[] {
  const here = currentCountry(j);
  if (here && !hasCleared(j, here)) return [];
  if (route.openWorld) return route.stops.filter((c) => !j.path.includes(c));
  const next = route.stops[j.path.length];
  return next ? [next] : [];
}

export type StopStatus = 'cleared' | 'current' | 'next' | 'locked';

export function stopStatus(j: Journey, route: Route, country: CountryId): StopStatus {
  if (currentCountry(j) === country) return hasCleared(j, country) ? 'cleared' : 'current';
  if (j.path.includes(country)) return 'cleared';
  if (destinations(j, route).includes(country)) return 'next';
  return 'locked';
}

export function recordScore(j: Journey, route: Route, country: CountryId, topic: TopicId, correct: number): Journey {
  const prev = j.scores[country]?.[topic] ?? 0;
  const scores = { ...j.scores, [country]: { ...j.scores[country], [topic]: Math.max(prev, correct) } };
  const next: Journey = { ...j, scores };
  next.completed = route.stops.every((c) => next.path.includes(c) && hasCleared(next, c));
  return next;
}

export function arrive(j: Journey, country: CountryId): Journey {
  if (currentCountry(j) === country) return j;
  return { ...j, path: [...j.path, country] };
}

/** Every stamp earned on every journey, merged into one passport. */
export function passport(save: SaveData): Partial<Record<CountryId, TopicId[]>> {
  const out: Partial<Record<CountryId, Set<TopicId>>> = {};
  for (const j of Object.values(save.journeys)) {
    for (const c of Object.keys(j.scores) as CountryId[]) {
      for (const t of clearedTopics(j, c)) (out[c] ??= new Set()).add(t);
    }
  }
  return Object.fromEntries(Object.entries(out).map(([c, s]) => [c, [...s!]]));
}

const KEY = 'get-around:save:v1';

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptySave();
    const parsed = JSON.parse(raw) as SaveData;
    return parsed?.version === 1 ? { ...emptySave(), ...parsed } : emptySave();
  } catch {
    return emptySave();
  }
}

export function writeSave(save: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Storage unavailable (private mode etc.) — progress lasts for this session only.
  }
}
