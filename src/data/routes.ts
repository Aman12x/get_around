import type { CountryId } from './countries';
import { COUNTRIES } from './countries';
import type { TopicId } from './topics';

export interface Route {
  id: string;
  name: string;
  /** Flight-number style code shown on the departures board. */
  code: string;
  tagline: string;
  color: string;
  /** Topics this route is built around — used to recommend routes from interests. */
  themes: TopicId[];
  /** Ordered stops. Empty for the open-world route. */
  stops: CountryId[];
  openWorld?: boolean;
}

export const ROUTES: Route[] = [
  {
    id: 'cradles',
    name: 'Cradles of Civilization',
    code: 'GA 001',
    tagline: 'Pyramids, philosophers & dynasties — where it all began.',
    color: '#f59e0b',
    themes: ['history', 'politics'],
    stops: ['egypt', 'greece', 'italy', 'india', 'china'],
  },
  {
    id: 'renaissance',
    name: 'Renaissance & Revolution',
    code: 'GA 015',
    tagline: 'From Florentine studios to the storming of the Bastille.',
    color: '#ec4899',
    themes: ['art', 'politics', 'history'],
    stops: ['italy', 'france', 'uk', 'usa'],
  },
  {
    id: 'inventors',
    name: 'The Inventors’ Trail',
    code: 'GA 042',
    tagline: 'Steam engines, bullet trains and moonshots.',
    color: '#22d3ee',
    themes: ['technology', 'current-affairs'],
    stops: ['uk', 'usa', 'japan', 'china', 'india'],
  },
  {
    id: 'silk',
    name: 'The Silk Road',
    code: 'GA 088',
    tagline: 'Follow silk, spice and stories from Xi’an to Venice.',
    color: '#dc2626',
    themes: ['history', 'general', 'art'],
    stops: ['china', 'india', 'egypt', 'greece', 'italy'],
  },
  {
    id: 'new-world',
    name: 'New World Odyssey',
    code: 'GA 492',
    tagline: 'Maya astronomers, samba streets and the American dream.',
    color: '#10b981',
    themes: ['general', 'art', 'current-affairs'],
    stops: ['mexico', 'usa', 'brazil'],
  },
  {
    id: 'grand-tour',
    name: 'The Grand Tour',
    code: 'GA 777',
    tagline: 'The classic eleven-stop circuit, eastbound around the world.',
    color: '#a78bfa',
    themes: ['history', 'technology', 'art', 'politics', 'current-affairs', 'general'],
    stops: ['uk', 'france', 'italy', 'greece', 'egypt', 'india', 'china', 'japan', 'usa', 'mexico', 'brazil'],
  },
  {
    id: 'africa',
    name: 'Out of Africa',
    code: 'GA 230',
    tagline: 'From the souks of Marrakesh to the Cape of Good Hope.',
    color: '#ea580c',
    themes: ['history', 'general', 'art'],
    stops: ['morocco', 'nigeria', 'ethiopia', 'kenya', 'south-africa'],
  },
  {
    id: 'crossroads',
    name: 'Crossroads of Empires',
    code: 'GA 312',
    tagline: 'Byzantium, the Rose City, Persepolis and a desert skyline.',
    color: '#0891b2',
    themes: ['history', 'art', 'politics'],
    stops: ['turkey', 'jordan', 'iran', 'uae'],
  },
  {
    id: 'northern-lights',
    name: 'Northern Lights',
    code: 'GA 066',
    tagline: 'Vikings, fjords, Nobel prizes and the land of fire and ice.',
    color: '#2563eb',
    themes: ['technology', 'art', 'general'],
    stops: ['denmark', 'sweden', 'norway', 'iceland'],
  },
  {
    id: 'southern-cross',
    name: 'Under the Southern Cross',
    code: 'GA 404',
    tagline: 'Table Mountain to the Opera House, Aotearoa and Rio.',
    color: '#059669',
    themes: ['general', 'current-affairs', 'history'],
    stops: ['south-africa', 'australia', 'new-zealand', 'brazil'],
  },
  {
    id: 'open-world',
    name: 'Open Skies',
    code: 'GA ∞',
    tagline: 'Pick any country to start, then chart your own course.',
    color: '#38bdf8',
    themes: [],
    stops: COUNTRIES.map((c) => c.id),
    openWorld: true,
  },
];

export const ROUTE_BY_ID: Record<string, Route> = Object.fromEntries(ROUTES.map((r) => [r.id, r]));

/** Score routes against a traveler's interests; higher = better match. */
export function routeMatch(route: Route, interests: TopicId[]): number {
  if (route.openWorld || interests.length === 0) return 0;
  const hits = route.themes.filter((t) => interests.includes(t)).length;
  return hits / route.themes.length + hits * 0.25;
}

export function recommendedRouteIds(interests: TopicId[], count = 2): string[] {
  return ROUTES.filter((r) => !r.openWorld)
    .map((r) => ({ id: r.id, score: routeMatch(r, interests) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((r) => r.id);
}
