import type { CountryId } from '../data/countries';
import type { Place, TimelineEvent } from '../data/extras';
import type { TopicId } from '../data/topics';
import type { LevelId } from './levels';
import { shuffle, type QuizQuestion, type Rng } from './quiz';

/**
 * Round types beyond plain multiple choice. A quiz is still 10 items and the 90% rule
 * still applies; some items are simply played differently.
 */

export interface McqItem extends QuizQuestion {
  kind: 'mcq';
}

/** "Is it X?" — a multiple-choice question flipped into a quick true/false call. */
export interface TrueFalseItem {
  kind: 'tf';
  id: string;
  q: string;
  claim: string;
  truth: boolean;
  /** The real answer, revealed afterwards. */
  answer: string;
  fact: string;
  difficulty: number;
  asOf?: string;
}

/** Put events in chronological order. `events` is in display (shuffled) order. */
export interface TimelineItem {
  kind: 'order';
  id: string;
  events: TimelineEvent[];
  difficulty: number;
}

/** Tap a place on the country map; correct within `radiusKm`. */
export interface PinItem {
  kind: 'pin';
  id: string;
  place: Place;
  radiusKm: number;
  difficulty: number;
}

/** Pick this country's landmark out of four 3D islands. */
export interface LandmarkItem {
  kind: 'landmark';
  id: string;
  answer: CountryId;
  options: CountryId[];
  difficulty: number;
}

export type QuizItem = McqItem | TrueFalseItem | TimelineItem | PinItem | LandmarkItem;

// ---------- builders ----------

export function toTrueFalse(q: QuizQuestion, rng: Rng): TrueFalseItem {
  const truth = rng() < 0.5;
  const wrong = q.choices.filter((_, i) => i !== q.correctIndex);
  const answer = q.choices[q.correctIndex];
  return {
    kind: 'tf',
    id: q.id,
    q: q.q,
    claim: truth ? answer : wrong[Math.floor(rng() * wrong.length)],
    truth,
    answer,
    fact: q.fact,
    difficulty: q.difficulty,
    asOf: q.asOf,
  };
}

const TIMELINE_SIZE: Record<LevelId, number> = { explorer: 3, voyager: 4, legend: 5 };
const TIMELINE_MAX_DIFFICULTY: Record<LevelId, number> = { explorer: 1, voyager: 2, legend: 3 };

/** Two events are far enough apart to order without arguing over dates. */
function distinct(a: TimelineEvent, b: TimelineEvent): boolean {
  const gap = Math.abs(a.year - b.year);
  return a.approx || b.approx ? gap >= 100 : gap >= 2;
}

export function makeTimeline(events: readonly TimelineEvent[], level: LevelId, rng: Rng): TimelineItem | null {
  const size = TIMELINE_SIZE[level];
  const maxD = TIMELINE_MAX_DIFFICULTY[level];
  // Prefer events at this level's difficulty, falling back to the rest.
  const preferred = shuffle(
    events.filter((e) => e.difficulty <= maxD),
    rng,
  );
  const rest = shuffle(
    events.filter((e) => e.difficulty > maxD),
    rng,
  );
  const picked: TimelineEvent[] = [];
  for (const e of [...preferred, ...rest]) {
    if (picked.every((p) => distinct(p, e))) picked.push(e);
    if (picked.length === size) break;
  }
  if (picked.length < size) return null;
  const sorted = [...picked].sort((a, b) => a.year - b.year);
  return {
    kind: 'order',
    id: 'tl:' + sorted.map((e) => e.year).join(','),
    events: shuffle(picked, rng),
    difficulty: Math.max(...picked.map((e) => e.difficulty)),
  };
}

/** True when `order` (indexes into item.events) lists the events oldest → newest. */
export function isChronological(item: TimelineItem, order: readonly number[]): boolean {
  if (order.length !== item.events.length) return false;
  for (let i = 1; i < order.length; i++) {
    if (item.events[order[i - 1]].year > item.events[order[i]].year) return false;
  }
  return true;
}

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const PIN_FACTOR: Record<LevelId, number> = { explorer: 0.09, voyager: 0.06, legend: 0.04 };

/** How close a tap must be: a share of the map's diagonal, so big countries are fair too. */
export function pinRadiusKm(view: readonly [number, number, number, number], level: LevelId): number {
  const [s, n, w, e] = view;
  const diag = distanceKm({ lat: s, lon: w }, { lat: n, lon: e });
  return Math.max(40, Math.round(diag * PIN_FACTOR[level]));
}

export function makePins(
  places: readonly Place[],
  view: readonly [number, number, number, number],
  level: LevelId,
  count: number,
  rng: Rng,
): PinItem[] {
  const maxD = TIMELINE_MAX_DIFFICULTY[level];
  const ranked = [
    ...shuffle(
      places.filter((p) => p.difficulty <= maxD),
      rng,
    ),
    ...shuffle(
      places.filter((p) => p.difficulty > maxD),
      rng,
    ),
  ];
  const radiusKm = pinRadiusKm(view, level);
  return ranked.slice(0, count).map((place) => ({
    kind: 'pin',
    id: 'pin:' + place.name,
    place,
    radiusKm,
    difficulty: place.difficulty,
  }));
}

export function makeLandmark(country: CountryId, all: readonly CountryId[], rng: Rng): LandmarkItem {
  const others = shuffle(
    all.filter((c) => c !== country),
    rng,
  ).slice(0, 3);
  return { kind: 'landmark', id: 'lm:' + country, answer: country, options: shuffle([country, ...others], rng), difficulty: 1 };
}

// ---------- assembling a quiz ----------

export interface RoundPlan {
  timelines: number;
  pins: number;
  landmarks: number;
  trueFalse: number;
}

/** Which special rounds a subject/level gets (the rest of the 10 stay multiple choice). */
export function planRounds(topic: TopicId, level: LevelId): RoundPlan {
  const plan: RoundPlan = { timelines: 0, pins: 0, landmarks: 0, trueFalse: 0 };
  if (topic === 'history') plan.timelines = level === 'legend' ? 2 : 1;
  if (topic === 'general') {
    plan.pins = 2;
    plan.landmarks = level === 'explorer' ? 1 : 0;
  }
  plan.trueFalse = level === 'explorer' ? 2 : level === 'voyager' ? 1 : 0;
  return plan;
}

export interface AssembleInput {
  mcqs: QuizQuestion[];
  country: CountryId;
  topic: TopicId;
  level: LevelId;
  timeline: readonly TimelineEvent[];
  places: readonly Place[];
  view: readonly [number, number, number, number];
  allCountries: readonly CountryId[];
  rng: Rng;
}

/**
 * Mix special rounds into an easy→hard list of multiple-choice questions, keeping the
 * total the same. Rounds that lack content (e.g. no timeline yet) quietly stay MCQ.
 */
export function assembleQuiz(input: AssembleInput): QuizItem[] {
  const { mcqs, level, rng } = input;
  const plan = planRounds(input.topic, level);
  const specials: QuizItem[] = [];

  if (plan.landmarks) specials.push(makeLandmark(input.country, input.allCountries, rng));
  const used = new Set<string>();
  for (let i = 0; i < plan.timelines; i++) {
    // Retry a few times so two timelines in one quiz don't share their exact event set.
    for (let tries = 0; tries < 5; tries++) {
      const t = makeTimeline(input.timeline, level, rng);
      if (t && !used.has(t.id)) {
        used.add(t.id);
        specials.push(t);
        break;
      }
    }
  }
  specials.push(...makePins(input.places, input.view, level, plan.pins, rng));

  // Drop the MCQs these replace, taking from the middle of the difficulty climb.
  const keep = mcqs.slice(0, Math.max(0, mcqs.length - specials.length));
  const items: QuizItem[] = keep.map((q) => ({ ...q, kind: 'mcq' }) as McqItem);

  // Flip the easiest few multiple-choice questions into quick true/false calls.
  let flips = plan.trueFalse;
  for (let i = 0; i < items.length && flips > 0; i++) {
    const it = items[i];
    if (it.kind === 'mcq' && it.difficulty === 1) {
      items[i] = toTrueFalse(it, rng);
      flips--;
    }
  }

  // Spread specials through the quiz rather than bunching them at the end.
  const total = items.length + specials.length;
  specials.forEach((sp, k) => {
    const at = Math.min(items.length, Math.round(((k + 1) * total) / (specials.length + 1)) - 1);
    items.splice(Math.max(1, at), 0, sp);
  });
  return items;
}
