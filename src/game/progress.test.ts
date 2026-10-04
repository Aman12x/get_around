import { describe, expect, it } from 'vitest';
import { ROUTE_BY_ID } from '../data/routes';
import {
  arrive,
  destinations,
  emptySave,
  hasCleared,
  levelUnlocked,
  markSeen,
  migrateV1,
  newJourney,
  passport,
  recordScore,
  seenSet,
  stampCounts,
  stopStatus,
  topicTier,
} from './progress';

const cradles = ROUTE_BY_ID['cradles'];
const open = ROUTE_BY_ID['open-world'];

describe('route progression', () => {
  it('starts at the first stop and unlocks the next only after a 90% score', () => {
    let j = newJourney('cradles');
    expect(destinations(j, cradles)).toEqual(['egypt']);
    j = arrive(j, 'egypt');
    expect(destinations(j, cradles)).toEqual([]);
    expect(stopStatus(j, cradles, 'egypt')).toBe('current');
    expect(stopStatus(j, cradles, 'greece')).toBe('locked');

    j = recordScore(j, cradles, 'egypt', 'history', 'explorer', 8);
    expect(hasCleared(j, 'egypt')).toBe(false);
    j = recordScore(j, cradles, 'egypt', 'art', 'explorer', 9);
    expect(hasCleared(j, 'egypt')).toBe(true);
    expect(destinations(j, cradles)).toEqual(['greece']);
    expect(stopStatus(j, cradles, 'greece')).toBe('next');
    expect(stopStatus(j, cradles, 'egypt')).toBe('cleared');
  });

  it('keeps the best score per topic and level', () => {
    let j = arrive(newJourney('cradles'), 'egypt');
    j = recordScore(j, cradles, 'egypt', 'history', 'explorer', 10);
    j = recordScore(j, cradles, 'egypt', 'history', 'explorer', 4);
    j = recordScore(j, cradles, 'egypt', 'history', 'voyager', 6);
    expect(j.scores.egypt?.history).toEqual({ explorer: 10, voyager: 6 });
  });

  it('marks the route complete once every stop is cleared', () => {
    let j = newJourney('cradles');
    for (const c of cradles.stops) {
      expect(j.completed).toBe(false);
      j = recordScore(arrive(j, c), cradles, c, 'general', 'explorer', 10);
    }
    expect(j.completed).toBe(true);
    expect(destinations(j, cradles)).toEqual([]);
  });
});

describe('levels', () => {
  it('opens Voyager after Explorer and Legend after Voyager', () => {
    let j = arrive(newJourney('cradles'), 'egypt');
    expect(levelUnlocked(j, 'egypt', 'art', 'explorer')).toBe(true);
    expect(levelUnlocked(j, 'egypt', 'art', 'voyager')).toBe(false);
    j = recordScore(j, cradles, 'egypt', 'art', 'explorer', 9);
    expect(levelUnlocked(j, 'egypt', 'art', 'voyager')).toBe(true);
    expect(levelUnlocked(j, 'egypt', 'art', 'legend')).toBe(false);
    expect(levelUnlocked(j, 'egypt', 'history', 'voyager')).toBe(false);
    j = recordScore(j, cradles, 'egypt', 'art', 'voyager', 10);
    expect(levelUnlocked(j, 'egypt', 'art', 'legend')).toBe(true);
  });

  it('reports the highest level passed as the stamp tier', () => {
    let j = arrive(newJourney('cradles'), 'egypt');
    expect(topicTier(j, 'egypt', 'art')).toBeNull();
    j = recordScore(j, cradles, 'egypt', 'art', 'explorer', 9);
    expect(topicTier(j, 'egypt', 'art')).toBe('explorer');
    j = recordScore(j, cradles, 'egypt', 'art', 'voyager', 7);
    expect(topicTier(j, 'egypt', 'art')).toBe('explorer');
    j = recordScore(j, cradles, 'egypt', 'art', 'voyager', 9);
    expect(topicTier(j, 'egypt', 'art')).toBe('voyager');
  });
});

describe('open world', () => {
  it('lets the traveler start anywhere and choose any unvisited country next', () => {
    let j = newJourney('open-world');
    expect(destinations(j, open)).toHaveLength(open.stops.length);
    j = arrive(j, 'japan');
    expect(destinations(j, open)).toEqual([]);
    j = recordScore(j, open, 'japan', 'art', 'explorer', 9);
    const next = destinations(j, open);
    expect(next).not.toContain('japan');
    expect(next).toHaveLength(open.stops.length - 1);
  });
});

describe('passport', () => {
  it('keeps the best tier per subject across journeys', () => {
    const save = emptySave();
    save.journeys.cradles = recordScore(arrive(newJourney('cradles'), 'egypt'), cradles, 'egypt', 'art', 'explorer', 9);
    let o = recordScore(arrive(newJourney('open-world'), 'egypt'), open, 'egypt', 'art', 'explorer', 10);
    o = recordScore(o, open, 'egypt', 'art', 'voyager', 9);
    save.journeys['open-world'] = o;
    expect(passport(save)).toEqual({ egypt: { art: 'voyager' } });
    expect(stampCounts(save)).toEqual({ stamps: 1, gold: 0, silver: 1, bronze: 0 });
  });
});

describe('recently seen questions', () => {
  it('remembers ids per country and subject, newest last, capped', () => {
    let save = emptySave();
    save = markSeen(save, 'egypt', 'art', ['a', 'b']);
    save = markSeen(save, 'egypt', 'art', ['b', 'c']);
    expect(save.seen['egypt:art']).toEqual(['a', 'b', 'c']);
    expect(seenSet(save, 'egypt', 'history').size).toBe(0);
    save = markSeen(save, 'egypt', 'art', Array.from({ length: 50 }, (_, i) => `q${i}`));
    expect(save.seen['egypt:art']).toHaveLength(40);
    expect(save.seen['egypt:art'].at(-1)).toBe('q49');
  });
});

describe('save migration', () => {
  it('turns v1 single scores into Explorer scores', () => {
    const v2 = migrateV1({
      version: 1,
      traveler: { name: 'Aman', interests: ['history'] },
      activeRouteId: 'cradles',
      journeys: { cradles: { routeId: 'cradles', path: ['egypt'], scores: { egypt: { art: 9, history: 7 } }, completed: false } },
      muted: true,
    });
    expect(v2.version).toBe(2);
    expect(v2.traveler?.name).toBe('Aman');
    expect(v2.muted).toBe(true);
    expect(v2.journeys.cradles.scores.egypt).toEqual({ art: { explorer: 9 }, history: { explorer: 7 } });
    expect(hasCleared(v2.journeys.cradles, 'egypt')).toBe(true);
  });
});
