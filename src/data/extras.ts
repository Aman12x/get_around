import type { CountryId } from './countries';

export interface TimelineEvent {
  event: string;
  /** Negative for BCE. */
  year: number;
  label: string;
  approx?: boolean;
  difficulty: 1 | 2 | 3;
}

export interface Place {
  name: string;
  kind: 'city' | 'landmark' | 'nature' | 'historic';
  lat: number;
  lon: number;
  clue: string;
  difficulty: 1 | 2 | 3;
}

export interface Extras {
  country: CountryId;
  timeline: TimelineEvent[];
  places: Place[];
}

// Like the question banks, each country's extras are a small chunk loaded on arrival.
const loaders = import.meta.glob<Extras>('./extras/*.json', { import: 'default' });
const cache = new Map<CountryId, Extras>();

export async function loadExtras(country: CountryId): Promise<Extras> {
  const hit = cache.get(country);
  if (hit) return hit;
  const loader = loaders[`./extras/${country}.json`];
  const extras = loader ? await loader() : { country, timeline: [], places: [] };
  cache.set(country, extras);
  return extras;
}

export function extrasFor(country: CountryId): Extras {
  return cache.get(country) ?? { country, timeline: [], places: [] };
}
