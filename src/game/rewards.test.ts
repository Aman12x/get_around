import { describe, expect, it } from 'vitest';
import { ROUTE_BY_ID } from '../data/routes';
import { arrive, emptySave, newJourney, recordScore, withDefaults } from './progress';
import {
  addMiles,
  buy,
  checkAchievements,
  equip,
  fiftyFifty,
  localPoll,
  milesForAnswer,
  milesForFlight,
  recordAnswer,
  recordFlight,
  recordQuizEnd,
  spendMiles,
} from './rewards';

function seeded(seed: number) {
  return () => ((seed = (seed * 16807 + 12345) % 2147483647) / 2147483647);
}

describe('air miles', () => {
  it('pays more at higher levels and for streaks of 3+', () => {
    expect(milesForAnswer('explorer', 1)).toBe(10);
    expect(milesForAnswer('voyager', 1)).toBe(15);
    expect(milesForAnswer('legend', 2)).toBe(20);
    expect(milesForAnswer('explorer', 3)).toBe(16);
    expect(milesForAnswer('explorer', 40)).toBe(30); // streak bonus caps at 10
    expect(milesForFlight(1100)).toBe(110);
    expect(milesForFlight(30)).toBe(25);
  });

  it('tracks streaks and stats per answer', () => {
    let s = emptySave();
    for (let i = 0; i < 4; i++) s = recordAnswer(s, { right: true, kind: 'mcq', level: 'explorer' }).save;
    expect(s.rewards.streak).toBe(4);
    expect(s.rewards.miles).toBe(10 + 10 + 16 + 18);
    s = recordAnswer(s, { right: false, kind: 'mcq', level: 'explorer' }).save;
    expect(s.rewards.streak).toBe(0);
    expect(s.rewards.bestStreak).toBe(4);
    s = recordAnswer(s, { right: true, kind: 'order', level: 'voyager' }).save;
    s = recordAnswer(s, { right: false, kind: 'pin', level: 'voyager', distanceKm: 12 }).save;
    expect(s.rewards.stats).toMatchObject({ answered: 7, correct: 5, timelinesRight: 1, bullseyes: 1 });
  });

  it('pays stamp and route bonuses only for new achievements', () => {
    let s = emptySave();
    s = recordQuizEnd(s, { level: 'voyager', correct: 9, total: 10, passed: true, newTier: true, routeCompleted: false, usedLifeline: false }).save;
    expect(s.rewards.miles).toBe(100);
    s = recordQuizEnd(s, { level: 'voyager', correct: 10, total: 10, passed: true, newTier: false, routeCompleted: true, usedLifeline: false }).save;
    expect(s.rewards.miles).toBe(600);
    expect(s.rewards.stats.perfectQuizzes).toBe(1);
  });

  it('never spends more than you have', () => {
    const s = addMiles(emptySave(), 50);
    expect(spendMiles(s, 60)).toBeNull();
    expect(spendMiles(s, 40)!.rewards.miles).toBe(10);
  });

  it('records distance flown', () => {
    const { save, gained } = recordFlight(emptySave(), 2345);
    expect(gained).toBe(235);
    expect(save.rewards.stats.kmFlown).toBe(2345);
  });
});

describe('lifelines', () => {
  it('50:50 removes exactly two wrong answers', () => {
    for (let s = 1; s < 30; s++) {
      const gone = fiftyFifty(4, 2, seeded(s));
      expect(gone).toHaveLength(2);
      expect(gone).not.toContain(2);
      expect(new Set(gone).size).toBe(2);
    }
  });

  it('the local poll sums to 100 and usually favours the answer', () => {
    let favoured = 0;
    for (let s = 1; s < 200; s++) {
      const poll = localPoll(4, 1, 'explorer', seeded(s));
      expect(poll.reduce((a, b) => a + b, 0)).toBe(100);
      if (poll[1] === Math.max(...poll)) favoured++;
    }
    expect(favoured).toBeGreaterThan(170);
  });
});

describe('hangar', () => {
  it('buys with miles, equips, and refuses repeats or overspending', () => {
    let s = addMiles(emptySave(), 400);
    expect(buy(s, 'royal')).toEqual({ ok: false, reason: 'miles' });
    const r = buy(s, 'sunset');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    s = r.save;
    expect(s.rewards.miles).toBe(100);
    expect(s.rewards.livery).toBe('sunset');
    expect(buy(s, 'sunset')).toEqual({ ok: false, reason: 'owned' });
    expect(equip(s, 'classic').rewards.livery).toBe('classic');
    expect(equip(s, 'royal').rewards.livery).toBe('sunset'); // not owned
  });
});

describe('achievements', () => {
  it('unlocks once, paying its reward', () => {
    const cradles = ROUTE_BY_ID.cradles;
    let s = emptySave();
    s.journeys.cradles = recordScore(arrive(newJourney('cradles'), 'egypt'), cradles, 'egypt', 'art', 'explorer', 9);
    const first = checkAchievements(s, 1);
    expect(first.unlocked.map((a) => a.id)).toEqual(['first-stamp']);
    expect(first.save.rewards.miles).toBe(50);
    expect(checkAchievements(first.save, 2).unlocked).toEqual([]);
  });
});

describe('save defaults', () => {
  it('adds rewards to saves written before rewards existed', () => {
    const old = { version: 2 as const, traveler: null, activeRouteId: null, journeys: {}, seen: {}, muted: false };
    const s = withDefaults(old);
    expect(s.rewards.miles).toBe(0);
    expect(s.rewards.owned).toContain('classic');
    expect(withDefaults({ ...old, rewards: { miles: 70, stats: { correct: 3 } } as never }).rewards).toMatchObject({
      miles: 70,
      livery: 'classic',
      stats: { correct: 3, answered: 0 },
    });
  });
});
