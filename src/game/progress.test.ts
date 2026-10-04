import { describe, expect, it } from 'vitest';
import { ROUTE_BY_ID } from '../data/routes';
import { arrive, destinations, emptySave, hasCleared, newJourney, passport, recordScore, stopStatus } from './progress';

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

    j = recordScore(j, cradles, 'egypt', 'history', 8);
    expect(hasCleared(j, 'egypt')).toBe(false);
    j = recordScore(j, cradles, 'egypt', 'art', 9);
    expect(hasCleared(j, 'egypt')).toBe(true);
    expect(destinations(j, cradles)).toEqual(['greece']);
    expect(stopStatus(j, cradles, 'greece')).toBe('next');
    expect(stopStatus(j, cradles, 'egypt')).toBe('cleared');
  });

  it('keeps the best score per topic', () => {
    let j = arrive(newJourney('cradles'), 'egypt');
    j = recordScore(j, cradles, 'egypt', 'history', 10);
    j = recordScore(j, cradles, 'egypt', 'history', 4);
    expect(j.scores.egypt?.history).toBe(10);
  });

  it('marks the route complete once every stop is cleared', () => {
    let j = newJourney('cradles');
    for (const c of cradles.stops) {
      expect(j.completed).toBe(false);
      j = recordScore(arrive(j, c), cradles, c, 'general', 10);
    }
    expect(j.completed).toBe(true);
    expect(destinations(j, cradles)).toEqual([]);
  });
});

describe('open world', () => {
  it('lets the traveler start anywhere and choose any unvisited country next', () => {
    let j = newJourney('open-world');
    expect(destinations(j, open)).toHaveLength(open.stops.length);
    j = arrive(j, 'japan');
    expect(destinations(j, open)).toEqual([]);
    j = recordScore(j, open, 'japan', 'art', 9);
    const next = destinations(j, open);
    expect(next).not.toContain('japan');
    expect(next).toHaveLength(open.stops.length - 1);
  });
});

describe('passport', () => {
  it('merges stamps across journeys without duplicates', () => {
    const save = emptySave();
    save.journeys.cradles = recordScore(arrive(newJourney('cradles'), 'egypt'), cradles, 'egypt', 'art', 9);
    save.journeys['open-world'] = recordScore(arrive(newJourney('open-world'), 'egypt'), open, 'egypt', 'art', 10);
    expect(passport(save)).toEqual({ egypt: ['art'] });
  });
});
