import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COUNTRIES, COUNTRY_BY_ID, type CountryId } from './countries';
import type { Extras } from './extras';
import { makeTimeline } from '../game/rounds';

const dir = fileURLToPath(new URL('./extras/', import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const load = (f: string) => JSON.parse(readFileSync(dir + f, 'utf8')) as Extras;

describe('extra round content', () => {
  it('exists for every playable country', () => {
    expect(files.map((f) => f.replace('.json', '')).sort()).toEqual(COUNTRIES.map((c) => c.id).sort());
  });

  for (const f of files) {
    const extras = load(f);
    const country = COUNTRY_BY_ID[extras.country as CountryId];

    it(`${f}: every place sits inside the map-round frame`, () => {
      const [s, n, w, e] = country.mapView;
      for (const p of extras.places) {
        expect(p.lat, p.name).toBeGreaterThan(s);
        expect(p.lat, p.name).toBeLessThan(n);
        expect(p.lon, p.name).toBeGreaterThan(w);
        expect(p.lon, p.name).toBeLessThan(e);
      }
    });

    it(`${f}: has enough well-spaced events for every level's timeline`, () => {
      let seed = 1;
      const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (const level of ['explorer', 'voyager', 'legend'] as const) {
        for (let i = 0; i < 20; i++) expect(makeTimeline(extras.timeline, level, rng), level).not.toBeNull();
      }
    });
  }
});
