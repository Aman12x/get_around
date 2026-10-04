import { COUNTRIES } from '../data/countries';
import { TOPICS } from '../data/topics';
import type { LevelId } from './levels';
import type { SaveData } from './progress';
import { passport } from './progress';

/** Air miles, streaks, lifelines, cosmetics and achievements. Pure functions over SaveData. */

export interface RewardStats {
  answered: number;
  correct: number;
  perfectQuizzes: number;
  timelinesRight: number;
  bullseyes: number;
  landmarksRight: number;
  kmFlown: number;
  goldNoHelp: number;
}

export interface RewardsState {
  miles: number;
  streak: number;
  bestStreak: number;
  stats: RewardStats;
  /** Achievement id → unlock time. */
  achievements: Record<string, number>;
  owned: string[];
  livery: string;
  cover: string;
  /** First-time tips already shown. */
  tips: string[];
}

export function emptyStats(): RewardStats {
  return { answered: 0, correct: 0, perfectQuizzes: 0, timelinesRight: 0, bullseyes: 0, landmarksRight: 0, kmFlown: 0, goldNoHelp: 0 };
}

export function emptyRewards(): RewardsState {
  return {
    miles: 0,
    streak: 0,
    bestStreak: 0,
    stats: emptyStats(),
    achievements: {},
    owned: ['classic', 'burgundy'],
    livery: 'classic',
    cover: 'burgundy',
    tips: [],
  };
}

// ---------- miles ----------

const LEVEL_MULTIPLIER: Record<LevelId, number> = { explorer: 1, voyager: 1.5, legend: 2 };
export const STAMP_BONUS: Record<LevelId, number> = { explorer: 50, voyager: 100, legend: 200 };
export const ROUTE_BONUS = 500;

/** 10 miles a correct answer (×1.5 Voyager, ×2 Legend), plus a growing bonus from a 3-answer streak. */
export function milesForAnswer(level: LevelId, streak: number): number {
  const base = Math.round(10 * LEVEL_MULTIPLIER[level]);
  return base + (streak >= 3 ? 2 * Math.min(streak, 10) : 0);
}

/** One air mile for every 10 km flown, at least 25. */
export function milesForFlight(km: number): number {
  return Math.max(25, Math.round(km / 10));
}

// ---------- lifelines ----------

export type LifelineId = 'fifty' | 'local';

export const LIFELINES: Record<LifelineId, { label: string; icon: string; cost: number; blurb: string }> = {
  fifty: { label: '50:50', icon: '✂️', cost: 60, blurb: 'Remove two wrong answers' },
  local: { label: 'Ask a local', icon: '📣', cost: 40, blurb: 'See how 100 locals would answer' },
};

/**
 * A crowd poll that usually favours the right answer, less reliably at harder levels.
 * Returns percentages per choice summing to 100.
 */
export function localPoll(choices: number, correct: number, level: LevelId, rng: () => number): number[] {
  const confidence = { explorer: 0.62, voyager: 0.5, legend: 0.38 }[level];
  const weights = Array.from({ length: choices }, (_, i) => (i === correct ? confidence * 3 : 0) + rng());
  const sum = weights.reduce((a, b) => a + b, 0);
  const pct = weights.map((w) => Math.round((w / sum) * 100));
  pct[correct] += 100 - pct.reduce((a, b) => a + b, 0);
  return pct;
}

/** Two wrong choice indexes to remove for 50:50. */
export function fiftyFifty(choices: number, correct: number, rng: () => number): number[] {
  const wrong = Array.from({ length: choices }, (_, i) => i).filter((i) => i !== correct);
  const keep = wrong[Math.floor(rng() * wrong.length)];
  return wrong.filter((i) => i !== keep).slice(0, 2);
}

// ---------- cosmetics ----------

export interface Cosmetic {
  id: string;
  kind: 'livery' | 'cover';
  name: string;
  price: number;
  /** Livery: body, accent, trail. Cover: two gradient stops. */
  colors: string[];
}

export const COSMETICS: Cosmetic[] = [
  { id: 'classic', kind: 'livery', name: 'Classic', price: 0, colors: ['#ffffff', '#ff4d6d', '#fde047'] },
  { id: 'sunset', kind: 'livery', name: 'Sunset', price: 300, colors: ['#fff7ed', '#f97316', '#fb7185'] },
  { id: 'ocean', kind: 'livery', name: 'Ocean', price: 300, colors: ['#e0f2fe', '#0284c7', '#22d3ee'] },
  { id: 'jungle', kind: 'livery', name: 'Jungle', price: 500, colors: ['#ecfccb', '#16a34a', '#a3e635'] },
  { id: 'midnight', kind: 'livery', name: 'Midnight', price: 800, colors: ['#312e81', '#a78bfa', '#c4b5fd'] },
  { id: 'royal', kind: 'livery', name: 'Royal Gold', price: 1500, colors: ['#fef3c7', '#b45309', '#fbbf24'] },
  { id: 'burgundy', kind: 'cover', name: 'Burgundy', price: 0, colors: ['#7f1d1d', '#be123c'] },
  { id: 'navy', kind: 'cover', name: 'Navy', price: 250, colors: ['#172554', '#2563eb'] },
  { id: 'emerald', kind: 'cover', name: 'Emerald', price: 250, colors: ['#064e3b', '#10b981'] },
  { id: 'holo', kind: 'cover', name: 'Holographic', price: 1200, colors: ['#ec4899', '#22d3ee'] },
  { id: 'goldleaf', kind: 'cover', name: 'Gold Leaf', price: 2000, colors: ['#78350f', '#fbbf24'] },
];

export const COSMETIC_BY_ID: Record<string, Cosmetic> = Object.fromEntries(COSMETICS.map((c) => [c.id, c]));

export type BuyResult = { ok: true; save: SaveData } | { ok: false; reason: 'owned' | 'miles' | 'unknown' };

export function buy(save: SaveData, id: string): BuyResult {
  const item = COSMETIC_BY_ID[id];
  if (!item) return { ok: false, reason: 'unknown' };
  if (save.rewards.owned.includes(id)) return { ok: false, reason: 'owned' };
  if (save.rewards.miles < item.price) return { ok: false, reason: 'miles' };
  const rewards = { ...save.rewards, miles: save.rewards.miles - item.price, owned: [...save.rewards.owned, id] };
  return { ok: true, save: equip({ ...save, rewards }, id) };
}

export function equip(save: SaveData, id: string): SaveData {
  const item = COSMETIC_BY_ID[id];
  if (!item || !save.rewards.owned.includes(id)) return save;
  return { ...save, rewards: { ...save.rewards, [item.kind]: id } };
}

// ---------- achievements ----------

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  desc: string;
  reward: number;
  done(save: SaveData): boolean;
}

const visitedCountries = (save: SaveData) => new Set(Object.values(save.journeys).flatMap((j) => j.path));
const tiers = (save: SaveData) => Object.values(passport(save)).flatMap((t) => Object.values(t ?? {}));

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-stamp', icon: '🛂', name: 'First Stamp', desc: 'Earn your first passport stamp.', reward: 50, done: (s) => tiers(s).length > 0 },
  { id: 'perfect-10', icon: '💯', name: 'Perfect 10', desc: 'Get every question right in a quiz.', reward: 100, done: (s) => s.rewards.stats.perfectQuizzes > 0 },
  { id: 'streak-10', icon: '🔥', name: 'Hot Streak', desc: 'Answer 10 in a row correctly.', reward: 100, done: (s) => s.rewards.bestStreak >= 10 },
  { id: 'streak-25', icon: '☄️', name: 'Unstoppable', desc: 'Answer 25 in a row correctly.', reward: 300, done: (s) => s.rewards.bestStreak >= 25 },
  { id: 'first-gold', icon: '👑', name: 'Legendary', desc: 'Earn a Gold stamp.', reward: 300, done: (s) => tiers(s).includes('legend') },
  {
    id: 'polymath',
    icon: '🎓',
    name: 'Polymath',
    desc: 'Stamp all six subjects in one country.',
    reward: 300,
    done: (s) => Object.values(passport(s)).some((t) => Object.keys(t ?? {}).length >= TOPICS.length),
  },
  { id: 'globetrotter', icon: '🧳', name: 'Globetrotter', desc: 'Land in 5 different countries.', reward: 150, done: (s) => visitedCountries(s).size >= 5 },
  { id: 'world-tour', icon: '🌍', name: 'World Tour', desc: 'Land in every country.', reward: 500, done: (s) => visitedCountries(s).size >= COUNTRIES.length },
  { id: 'route-master', icon: '🗺️', name: 'Route Master', desc: 'Complete any route.', reward: 300, done: (s) => Object.values(s.journeys).some((j) => j.completed) },
  { id: 'time-lord', icon: '⏳', name: 'Time Lord', desc: 'Order 5 timelines perfectly.', reward: 150, done: (s) => s.rewards.stats.timelinesRight >= 5 },
  { id: 'bullseye', icon: '🎯', name: 'Bullseye', desc: 'Pin a place within 25 km.', reward: 100, done: (s) => s.rewards.stats.bullseyes > 0 },
  { id: 'landmark-spotter', icon: '🏝️', name: 'Landmark Spotter', desc: 'Spot 3 landmarks.', reward: 100, done: (s) => s.rewards.stats.landmarksRight >= 3 },
  { id: 'high-flyer', icon: '✈️', name: 'High Flyer', desc: 'Fly 20,000 km.', reward: 200, done: (s) => s.rewards.stats.kmFlown >= 20000 },
  { id: 'no-help', icon: '🦉', name: 'No Help Needed', desc: 'Earn a Gold stamp without lifelines.', reward: 300, done: (s) => s.rewards.stats.goldNoHelp > 0 },
];

/** Award any achievements that have just become true; returns the new ones (miles included). */
export function checkAchievements(save: SaveData, now = Date.now()): { save: SaveData; unlocked: Achievement[] } {
  const unlocked = ACHIEVEMENTS.filter((a) => !save.rewards.achievements[a.id] && a.done(save));
  if (!unlocked.length) return { save, unlocked };
  const achievements = { ...save.rewards.achievements };
  for (const a of unlocked) achievements[a.id] = now;
  const miles = save.rewards.miles + unlocked.reduce((n, a) => n + a.reward, 0);
  return { save: { ...save, rewards: { ...save.rewards, achievements, miles } }, unlocked };
}

// ---------- events ----------

export type AnswerKind = 'mcq' | 'tf' | 'order' | 'pin' | 'landmark';

export interface AnswerEvent {
  right: boolean;
  kind: AnswerKind;
  level: LevelId;
  /** For map rounds: how far the tap was from the place. */
  distanceKm?: number;
}

/** Apply one answer: miles, streak and stats. Returns miles gained (0 when wrong). */
export function recordAnswer(save: SaveData, ev: AnswerEvent): { save: SaveData; gained: number } {
  const r = save.rewards;
  const streak = ev.right ? r.streak + 1 : 0;
  const gained = ev.right ? milesForAnswer(ev.level, streak) : 0;
  const stats = { ...r.stats, answered: r.stats.answered + 1, correct: r.stats.correct + (ev.right ? 1 : 0) };
  if (ev.right && ev.kind === 'order') stats.timelinesRight++;
  if (ev.right && ev.kind === 'landmark') stats.landmarksRight++;
  if (ev.kind === 'pin' && ev.distanceKm !== undefined && ev.distanceKm <= 25) stats.bullseyes++;
  return {
    save: { ...save, rewards: { ...r, streak, bestStreak: Math.max(r.bestStreak, streak), miles: r.miles + gained, stats } },
    gained,
  };
}

export function addMiles(save: SaveData, miles: number): SaveData {
  return { ...save, rewards: { ...save.rewards, miles: save.rewards.miles + miles } };
}

export function spendMiles(save: SaveData, miles: number): SaveData | null {
  if (save.rewards.miles < miles) return null;
  return addMiles(save, -miles);
}

export function recordFlight(save: SaveData, km: number): { save: SaveData; gained: number } {
  const gained = milesForFlight(km);
  const stats = { ...save.rewards.stats, kmFlown: save.rewards.stats.kmFlown + Math.round(km) };
  return { save: { ...save, rewards: { ...save.rewards, miles: save.rewards.miles + gained, stats } }, gained };
}

export interface QuizEndEvent {
  level: LevelId;
  correct: number;
  total: number;
  passed: boolean;
  /** This pass earned a stamp tier the player didn't have for this subject. */
  newTier: boolean;
  routeCompleted: boolean;
  usedLifeline: boolean;
}

export function recordQuizEnd(save: SaveData, ev: QuizEndEvent): { save: SaveData; gained: number } {
  let gained = 0;
  if (ev.passed && ev.newTier) gained += STAMP_BONUS[ev.level];
  if (ev.routeCompleted) gained += ROUTE_BONUS;
  const stats = { ...save.rewards.stats };
  if (ev.correct === ev.total) stats.perfectQuizzes++;
  if (ev.passed && ev.level === 'legend' && !ev.usedLifeline) stats.goldNoHelp++;
  return { save: { ...save, rewards: { ...save.rewards, miles: save.rewards.miles + gained, stats } }, gained };
}

export function markTip(save: SaveData, tip: string): SaveData {
  if (save.rewards.tips.includes(tip)) return save;
  return { ...save, rewards: { ...save.rewards, tips: [...save.rewards.tips, tip] } };
}
