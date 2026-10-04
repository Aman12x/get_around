// Validates timeline and map-place content in src/data/extras/*.json, including that
// every place falls inside its country's borders (game-shapes.json outlines).
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = `${root}src/data/extras/`;
const only = process.argv.slice(2);
const countriesSrc = readFileSync(`${root}src/data/countries.ts`, 'utf8');
const isoOf = Object.fromEntries([...countriesSrc.matchAll(/id: '([a-z-]+)', name: '[^']+', iso: '(\d+)'/g)].map((m) => [m[1], m[2]]));
const shapes = JSON.parse(readFileSync(`${root}src/three/generated/game-shapes.json`, 'utf8'));

function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inCountry(iso, lon, lat) {
  const f = shapes.features.find((x) => x.id === iso);
  if (!f) return false;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  return polys.some((p) => inRing(lon, lat, p[0]) && !p.slice(1).some((hole) => inRing(lon, lat, hole)));
}
/** Distance in km from a point to the country's outline (for coastal places on simplified borders). */
function kmToBorder(iso, lon, lat) {
  const f = shapes.features.find((x) => x.id === iso);
  if (!f) return Infinity;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
  const ky = 110.57;
  let best = Infinity;
  for (const poly of polys) {
    for (const ring of poly) {
      for (let i = 1; i < ring.length; i++) {
        const ax = (ring[i - 1][0] - lon) * kx, ay = (ring[i - 1][1] - lat) * ky;
        const bx = (ring[i][0] - lon) * kx, by = (ring[i][1] - lat) * ky;
        const dx = bx - ax, dy = by - ay;
        const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
        best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
      }
    }
  }
  return best;
}

function km(a, b) {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const errors = [];
let files = readdirSync(dir).filter((f) => f.endsWith('.json'));
if (only.length) files = files.filter((f) => only.includes(f.replace('.json', '')));
for (const file of files) {
  const d = JSON.parse(readFileSync(dir + file, 'utf8'));
  const id = file.replace('.json', '');
  const err = (m) => errors.push(`${file}: ${m}`);
  if (d.country !== id) err(`country "${d.country}" does not match the file name`);
  const iso = isoOf[id];
  if (!iso) err('unknown country id');

  const tl = d.timeline ?? [];
  if (tl.length < 16) err(`timeline needs at least 16 events (has ${tl.length})`);
  for (const e of tl) {
    if (!e.event || e.event.length > 80) err(`timeline event text missing or over 80 chars: ${e.event}`);
    if (!Number.isInteger(e.year)) err(`timeline year must be an integer: ${e.event}`);
    if (!e.label) err(`timeline label missing: ${e.event}`);
    if (/\b\d{3,4}\b/.test(e.event)) err(`timeline event text must not contain the year: ${e.event}`);
    if (![1, 2, 3].includes(e.difficulty)) err(`timeline difficulty must be 1-3: ${e.event}`);
  }

  const places = d.places ?? [];
  if (places.length < 10) err(`places needs at least 10 (has ${places.length})`);
  for (const p of places) {
    if (!p.name || typeof p.lat !== 'number' || typeof p.lon !== 'number') err(`place malformed: ${JSON.stringify(p)}`);
    if (!['city', 'landmark', 'nature', 'historic'].includes(p.kind)) err(`place kind invalid: ${p.name}`);
    if (!p.clue || p.clue.length > 160) err(`place clue missing or over 160 chars: ${p.name}`);
    if (![1, 2, 3].includes(p.difficulty)) err(`place difficulty must be 1-3: ${p.name}`);
    if (iso && !inCountry(iso, p.lon, p.lat) && kmToBorder(iso, p.lon, p.lat) > 30) {
      err(`place is outside the country's borders: ${p.name} (${p.lat}, ${p.lon})`);
    }
  }
  for (let i = 0; i < places.length; i++) {
    for (let k = i + 1; k < places.length; k++) {
      if (km(places[i], places[k]) < 50) err(`places too close (<50 km): ${places[i].name} / ${places[k].name}`);
    }
  }
}

if (errors.length) {
  console.error(`✘ ${errors.length} extras problem(s):\n` + errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}
console.log(`✔ extras valid (${files.length} countries)`);
