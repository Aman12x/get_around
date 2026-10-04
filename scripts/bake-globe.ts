// Bakes the globe's base atlas at build time so players' browsers don't download
// 750 KB of map data and repaint it on every visit.
//
//   npm run bake:globe          regenerate src/three/generated/*
//   npm run bake:globe -- --check   fail if the committed files are stale (CI)
//
// Outputs:
//   world.webp        4096×2048 equirectangular atlas (ocean, borders, colours)
//   game-shapes.json  outlines of the playable nations only, for route highlighting
import { createCanvas } from '@napi-rs/canvas';
import type { FeatureCollection, Geometry, Position } from 'geojson';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { COUNTRIES } from '../src/data/countries';
import { ATLAS_H, ATLAS_W, paintBase, type CountryFeature, type Paintable } from '../src/three/atlasPaint';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'src/three/generated');
const check = process.argv.includes('--check');

const require = createRequire(import.meta.url);
const topo = require('world-atlas/countries-50m.json') as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const world = feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>;
const features = world.features as CountryFeature[];

const QUALITY = Number(process.env.ATLAS_QUALITY ?? 80);
const playable = new Map(COUNTRIES.map((c) => [c.iso, c.color]));

// --- atlas image ---
let webp: Buffer = Buffer.alloc(0);
if (!check) {
  const canvas = createCanvas(ATLAS_W, ATLAS_H);
  paintBase(canvas.getContext('2d') as unknown as Paintable, features, playable);
  webp = canvas.toBuffer('image/webp', QUALITY);
}

// --- playable outlines, rounded to ~1 km and simplified ---
const round = (p: Position): Position => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];
// Douglas–Peucker with a tolerance of half a texel (1 texel ≈ 0.088°), so outlines stay pixel-exact.
const TOLERANCE = 0.044;
const simplifyRing = (ring: Position[]): Position[] => {
  const keep = new Uint8Array(ring.length);
  // Rings are closed (first point = last), so seed the split at the vertex farthest from the start.
  let far = 1;
  for (let i = 1; i < ring.length - 1; i++) {
    if (Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]) > Math.hypot(ring[far][0] - ring[0][0], ring[far][1] - ring[0][1])) far = i;
  }
  keep[0] = keep[far] = keep[ring.length - 1] = 1;
  const stack: Array<[number, number]> = [
    [0, far],
    [far, ring.length - 1],
  ];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = ring[a];
    const [bx, by] = ring[b];
    const len = Math.hypot(bx - ax, by - ay) || 1e-12;
    let worst = -1;
    let worstD = TOLERANCE;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - ring[i][1]) - (ax - ring[i][0]) * (by - ay)) / len;
      if (d > worstD) {
        worstD = d;
        worst = i;
      }
    }
    if (worst > 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return ring.filter((_, i) => keep[i]).map(round);
};
const simplifyPolygon = (poly: Position[][]) => poly.map(simplifyRing).filter((r) => r.length >= 4);
const roundGeom = (g: Geometry): Geometry => {
  if (g.type === 'Polygon') return { type: 'Polygon', coordinates: simplifyPolygon(g.coordinates) };
  if (g.type === 'MultiPolygon') {
    return { type: 'MultiPolygon', coordinates: g.coordinates.map(simplifyPolygon).filter((p) => p.length > 0) };
  }
  return g;
};
// A few ids are shared (Australia and the tiny Ashmore and Cartier Islands are both 036):
// keep the largest feature per id so outlines and map crops use the mainland.
const size = (f: CountryFeature) => JSON.stringify(f.geometry ?? '').length;
const mainland = new Map<string, CountryFeature>();
for (const f of features) {
  const id = String(f.id);
  if (!playable.has(id)) continue;
  const prev = mainland.get(id);
  if (!prev || size(f) > size(prev)) mainland.set(id, f);
}
const shapes = {
  type: 'FeatureCollection',
  features: [...mainland.values()]
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((f) => ({ type: 'Feature', id: String(f.id), properties: {}, geometry: roundGeom(f.geometry) })),
};
const shapesJson = JSON.stringify(shapes) + '\n';

// The image's pixels can differ by a hair between CPUs (Skia picks SIMD paths at runtime),
// so staleness is judged on a fingerprint of everything that feeds the bake instead.
const atlasVersion = (require('world-atlas/package.json') as { version: string }).version;
const fingerprint = createHash('sha256')
  .update(
    JSON.stringify({
      paint: readFileSync(join(root, 'src/three/atlasPaint.ts'), 'utf8'),
      playable: [...playable],
      atlasVersion,
      QUALITY,
      size: [ATLAS_W, ATLAS_H],
    }),
  )
  .digest('hex');
const metaJson = JSON.stringify({ inputs: fingerprint }, null, 2) + '\n';

const read = (name: string) => {
  try {
    return readFileSync(join(outDir, name), 'utf8');
  } catch {
    return null;
  }
};

if (check) {
  const stale = [
    read('world.meta.json') !== metaJson && 'world.webp',
    read('game-shapes.json') !== shapesJson && 'game-shapes.json',
  ].filter(Boolean);
  if (stale.length) {
    console.error(`✘ Baked globe is stale: ${stale.join(', ')}. Run \`npm run bake:globe\` and commit the result.`);
    process.exit(1);
  }
  console.log('✔ baked globe is up to date');
} else {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'world.webp'), webp);
  writeFileSync(join(outDir, 'game-shapes.json'), shapesJson);
  writeFileSync(join(outDir, 'world.meta.json'), metaJson);
  console.log(`✔ wrote world.webp (${(webp.length / 1024).toFixed(0)} KB) and game-shapes.json (${(shapesJson.length / 1024).toFixed(0)} KB)`);
}
