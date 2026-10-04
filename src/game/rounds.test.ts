import { describe, expect, it } from 'vitest';
import type { Place, TimelineEvent } from '../data/extras';
import { COUNTRIES, COUNTRY_BY_ID } from '../data/countries';
import { buildQuiz } from './quiz';
import type { Question } from '../data/questions';
import {
  assembleQuiz,
  distanceKm,
  isChronological,
  makeLandmark,
  makeTimeline,
  pinRadiusKm,
  planRounds,
  toTrueFalse,
} from './rounds';

function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

const ev = (event: string, year: number, difficulty: 1 | 2 | 3 = 1, approx = false): TimelineEvent => ({
  event,
  year,
  label: String(year),
  difficulty,
  approx,
});

const timeline = [
  ev('A', -2560, 1, true),
  ev('B', -2500, 1, true), // too close to A to order fairly (approximate dates)
  ev('C', 30, 1),
  ev('D', 641, 2),
  ev('E', 1869, 1),
  ev('F', 1952, 2),
  ev('G', 1953, 3),
  ev('H', 2011, 3),
];

const place = (name: string, lat: number, lon: number, difficulty: 1 | 2 | 3 = 1): Place => ({
  name,
  kind: 'city',
  lat,
  lon,
  clue: 'c',
  difficulty,
});

describe('timeline rounds', () => {
  it('picks the right number of events per level, never two approximate dates too close', () => {
    for (let s = 1; s < 40; s++) {
      const t = makeTimeline(timeline, 'legend', seeded(s))!;
      expect(t.events).toHaveLength(5);
      const names = t.events.map((e) => e.event);
      expect(names.includes('A') && names.includes('B')).toBe(false);
    }
    expect(makeTimeline(timeline, 'explorer', seeded(2))!.events).toHaveLength(3);
    expect(makeTimeline(timeline, 'explorer', seeded(2))!.events.every((e) => e.difficulty === 1)).toBe(true);
  });

  it('returns null when there are not enough events', () => {
    expect(makeTimeline(timeline.slice(0, 2), 'voyager', seeded(1))).toBeNull();
  });

  it('checks chronological answers', () => {
    const t = makeTimeline(timeline, 'voyager', seeded(7))!;
    const right = t.events.map((_, i) => i).sort((a, b) => t.events[a].year - t.events[b].year);
    expect(isChronological(t, right)).toBe(true);
    expect(isChronological(t, [...right].reverse())).toBe(false);
    expect(isChronological(t, right.slice(1))).toBe(false);
  });
});

describe('map rounds', () => {
  it('measures great-circle distance', () => {
    // London → Paris is about 344 km.
    expect(Math.round(distanceKm({ lat: 51.5074, lon: -0.1278 }, { lat: 48.8566, lon: 2.3522 }))).toBeGreaterThan(330);
    expect(Math.round(distanceKm({ lat: 51.5074, lon: -0.1278 }, { lat: 48.8566, lon: 2.3522 }))).toBeLessThan(360);
  });

  it('scales the tap radius with country size and level', () => {
    const greece = pinRadiusKm(COUNTRY_BY_ID.greece.mapView, 'explorer');
    const brazil = pinRadiusKm(COUNTRY_BY_ID.brazil.mapView, 'explorer');
    expect(brazil).toBeGreaterThan(greece);
    expect(pinRadiusKm(COUNTRY_BY_ID.brazil.mapView, 'legend')).toBeLessThan(brazil);
    expect(pinRadiusKm([0, 0.1, 0, 0.1], 'legend')).toBe(40);
  });
});

describe('true/false and landmark rounds', () => {
  it('flips a question into a claim that is either the answer or a distractor', () => {
    const [q] = buildQuiz([{ q: 'Q', choices: ['yes', 'n1', 'n2', 'n3'], answer: 0, fact: 'f', difficulty: 1 }], seeded(3));
    let trues = 0;
    for (let s = 1; s < 60; s++) {
      const tf = toTrueFalse(q, seeded(s * 104729 + 7));
      expect(tf.answer).toBe('yes');
      expect(tf.truth).toBe(tf.claim === 'yes');
      if (tf.truth) trues++;
    }
    expect(trues).toBeGreaterThan(10);
    expect(trues).toBeLessThan(50);
  });

  it('offers four distinct countries including the right one', () => {
    const lm = makeLandmark('egypt', COUNTRIES.map((c) => c.id), seeded(9));
    expect(lm.options).toHaveLength(4);
    expect(new Set(lm.options).size).toBe(4);
    expect(lm.options).toContain('egypt');
  });
});

describe('assembleQuiz', () => {
  const mcqPool: Question[] = Array.from({ length: 25 }, (_, i) => ({
    q: `Q${i}`,
    choices: ['a', 'b', 'c', 'd'],
    answer: 0,
    fact: 'f',
    difficulty: (i < 9 ? 1 : i < 18 ? 2 : 3) as 1 | 2 | 3,
  }));
  const places = [place('P1', 30, 31), place('P2', 25, 32), place('P3', 27, 30, 2)];
  const base = (topic: 'history' | 'general' | 'art', level: 'explorer' | 'voyager' | 'legend', s = 1) =>
    assembleQuiz({
      mcqs: buildQuiz(mcqPool, seeded(s), { mix: { 1: 4, 2: 3, 3: 3 } }),
      country: 'egypt',
      topic,
      level,
      timeline,
      places,
      view: COUNTRY_BY_ID.egypt.mapView,
      allCountries: COUNTRIES.map((c) => c.id),
      rng: seeded(s + 100),
    });
  const kinds = (items: { kind: string }[]) => items.map((i) => i.kind).sort().join(',');

  it('always keeps 10 items', () => {
    for (const topic of ['history', 'general', 'art'] as const) {
      for (const level of ['explorer', 'voyager', 'legend'] as const) expect(base(topic, level)).toHaveLength(10);
    }
  });

  it('mixes in the planned rounds', () => {
    expect(planRounds('general', 'explorer')).toEqual({ timelines: 0, pins: 2, landmarks: 1, trueFalse: 2 });
    const general = base('general', 'explorer');
    expect(kinds(general)).toBe('landmark,mcq,mcq,mcq,mcq,mcq,pin,pin,tf,tf');
    const history = base('history', 'legend');
    expect(history.filter((i) => i.kind === 'order')).toHaveLength(2);
    expect(history.filter((i) => i.kind === 'tf')).toHaveLength(0);
    expect(kinds(base('art', 'voyager'))).toBe('mcq,mcq,mcq,mcq,mcq,mcq,mcq,mcq,mcq,tf');
  });

  it('never opens a quiz with a special round', () => {
    for (let s = 1; s < 20; s++) expect(['mcq', 'tf']).toContain(base('general', 'explorer', s)[0].kind);
  });

  it('falls back to multiple choice when a country has no extra content', () => {
    const items = assembleQuiz({
      mcqs: buildQuiz(mcqPool, seeded(1)),
      country: 'egypt',
      topic: 'history',
      level: 'voyager',
      timeline: [],
      places: [],
      view: COUNTRY_BY_ID.egypt.mapView,
      allCountries: ['egypt'],
      rng: seeded(2),
    });
    expect(items).toHaveLength(10);
    expect(items.every((i) => i.kind === 'mcq' || i.kind === 'tf')).toBe(true);
  });
});
