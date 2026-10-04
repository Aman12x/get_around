import type { CountryId } from '../data/countries';
import type { Route } from '../data/routes';
import type { TopicId } from '../data/topics';
import { LEVELS, levelRank, type LevelId } from './levels';
import { isPass, QUIZ_LENGTH } from './quiz';

/** Best score (correct answers out of QUIZ_LENGTH) per level. */
export type LevelScores = Partial<Record<LevelId, number>>;
export type TopicScores = Partial<Record<TopicId, LevelScores>>;

export interface Journey {
  routeId: string;
  /** Countries landed in, in order. The last entry is the current location. */
  path: CountryId[];
  scores: Partial<Record<CountryId, TopicScores>>;
  completed: boolean;
}

export interface SaveData {
  version: 2;
  traveler: { name: string; interests: TopicId[] } | null;
  activeRouteId: string | null;
  journeys: Record<string, Journey>;
  /** Recently asked question ids per "country:topic", newest last. */
  seen: Record<string, string[]>;
  muted: boolean;
}

/** How many recent questions per country+topic to avoid repeating. */
const SEEN_LIMIT = 40;

export function emptySave(): SaveData {
  return { version: 2, traveler: null, activeRouteId: null, journeys: {}, seen: {}, muted: false };
}

export function newJourney(routeId: string): Journey {
  return { routeId, path: [], scores: {}, completed: false };
}

export function currentCountry(j: Journey): CountryId | null {
  return j.path.length ? j.path[j.path.length - 1] : null;
}

const passed = (score: number | undefined) => score !== undefined && isPass(score, QUIZ_LENGTH);

/** Highest level passed for a topic, or null. */
export function topicTier(j: Journey, country: CountryId, topic: TopicId): LevelId | null {
  const scores = j.scores[country]?.[topic] ?? {};
  let best: LevelId | null = null;
  for (const l of LEVELS) if (passed(scores[l.id])) best = l.id;
  return best;
}

export function bestScore(j: Journey, country: CountryId, topic: TopicId, level: LevelId): number | undefined {
  return j.scores[country]?.[topic]?.[level];
}

/** Explorer is always open; each further level needs the one before it. */
export function levelUnlocked(j: Journey, country: CountryId, topic: TopicId, level: LevelId): boolean {
  const rank = levelRank(level);
  if (rank <= 0) return true;
  return passed(j.scores[country]?.[topic]?.[LEVELS[rank - 1].id]);
}

/** A country is cleared (next flight unlocked) once any subject is passed at any level. */
export function hasCleared(j: Journey, country: CountryId): boolean {
  const topics = j.scores[country];
  if (!topics) return false;
  return Object.values(topics).some((levels) => Object.values(levels ?? {}).some(passed));
}

export function clearedTopics(j: Journey, country: CountryId): TopicId[] {
  return (Object.keys(j.scores[country] ?? {}) as TopicId[]).filter((t) => topicTier(j, country, t));
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

export function recordScore(
  j: Journey,
  route: Route,
  country: CountryId,
  topic: TopicId,
  level: LevelId,
  correct: number,
): Journey {
  const prevTopic = j.scores[country]?.[topic] ?? {};
  const best = Math.max(prevTopic[level] ?? 0, correct);
  const scores = {
    ...j.scores,
    [country]: { ...j.scores[country], [topic]: { ...prevTopic, [level]: best } },
  };
  const next: Journey = { ...j, scores };
  next.completed = route.stops.every((c) => next.path.includes(c) && hasCleared(next, c));
  return next;
}

export function arrive(j: Journey, country: CountryId): Journey {
  if (currentCountry(j) === country) return j;
  return { ...j, path: [...j.path, country] };
}

// ---------- recently seen questions ----------

const seenKey = (country: CountryId, topic: TopicId) => `${country}:${topic}`;

export function seenSet(save: SaveData, country: CountryId, topic: TopicId): Set<string> {
  return new Set(save.seen[seenKey(country, topic)] ?? []);
}

export function markSeen(save: SaveData, country: CountryId, topic: TopicId, ids: string[]): SaveData {
  const key = seenKey(country, topic);
  const prev = (save.seen[key] ?? []).filter((id) => !ids.includes(id));
  return { ...save, seen: { ...save.seen, [key]: [...prev, ...ids].slice(-SEEN_LIMIT) } };
}

// ---------- passport ----------

/** Best level earned per subject per country, merged across every journey. */
export function passport(save: SaveData): Partial<Record<CountryId, Partial<Record<TopicId, LevelId>>>> {
  const out: Partial<Record<CountryId, Partial<Record<TopicId, LevelId>>>> = {};
  for (const j of Object.values(save.journeys)) {
    for (const c of Object.keys(j.scores) as CountryId[]) {
      for (const t of Object.keys(j.scores[c] ?? {}) as TopicId[]) {
        const tier = topicTier(j, c, t);
        if (!tier) continue;
        const have = out[c]?.[t];
        if (!have || levelRank(tier) > levelRank(have)) (out[c] ??= {})[t] = tier;
      }
    }
  }
  return out;
}

export function stampCounts(save: SaveData): { stamps: number; gold: number; silver: number; bronze: number } {
  const tiers = Object.values(passport(save)).flatMap((t) => Object.values(t ?? {}));
  return {
    stamps: tiers.length,
    gold: tiers.filter((t) => t === 'legend').length,
    silver: tiers.filter((t) => t === 'voyager').length,
    bronze: tiers.filter((t) => t === 'explorer').length,
  };
}

// ---------- persistence ----------

const KEY_V1 = 'get-around:save:v1';
const KEY = 'get-around:save:v2';

interface SaveV1 {
  version: 1;
  traveler: SaveData['traveler'];
  activeRouteId: string | null;
  journeys: Record<string, Omit<Journey, 'scores'> & { scores: Partial<Record<CountryId, Partial<Record<TopicId, number>>>> }>;
  muted: boolean;
}

/** v1 stored one score per subject; those were all played at what is now the Explorer level. */
export function migrateV1(old: SaveV1): SaveData {
  const journeys: Record<string, Journey> = {};
  for (const [id, j] of Object.entries(old.journeys ?? {})) {
    const scores: Journey['scores'] = {};
    for (const [c, topics] of Object.entries(j.scores ?? {})) {
      scores[c as CountryId] = Object.fromEntries(
        Object.entries(topics ?? {}).map(([t, s]) => [t, { explorer: s as number }]),
      ) as TopicScores;
    }
    journeys[id] = { ...j, scores };
  }
  return { ...emptySave(), traveler: old.traveler ?? null, activeRouteId: old.activeRouteId ?? null, journeys, muted: !!old.muted };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SaveData;
      if (parsed?.version === 2) return { ...emptySave(), ...parsed };
    }
    const legacy = localStorage.getItem(KEY_V1);
    if (legacy) {
      const parsed = JSON.parse(legacy) as SaveV1;
      if (parsed?.version === 1) return migrateV1(parsed);
    }
  } catch {
    // Corrupt or unavailable storage: start fresh.
  }
  return emptySave();
}

export function writeSave(save: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Storage unavailable (private mode etc.) — progress lasts for this session only.
  }
}
