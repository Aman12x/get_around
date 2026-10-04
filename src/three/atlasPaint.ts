import type { Feature, Geometry, Position } from 'geojson';

/**
 * Atlas painting shared by the build-time baker (scripts/bake-globe.ts, Node canvas)
 * and the browser (route emphasis drawn over the baked image). No DOM types here so
 * both environments can use it.
 */

export const ATLAS_W = 4096;
export const ATLAS_H = 2048;

/** The subset of a 2D canvas context the atlas needs. */
export interface Paintable {
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  lineJoin: string;
  globalAlpha: number;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  fill(rule?: 'evenodd' | 'nonzero'): void;
  stroke(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): { addColorStop(offset: number, color: string): void };
  save(): void;
  restore(): void;
}

export type CountryFeature = Feature<Geometry, { name?: string }>;

const PASTELS = ['#a7e8bd', '#fde9a9', '#fbc7b5', '#d4c8fb', '#b6dcfb', '#fcd2a8', '#b4efe2', '#f8c6e0', '#d9f2a5'];

/** Opacity of playable countries when they are not on the active route. */
export const IDLE_ALPHA = 0.75;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const project = (lon: number, lat: number): [number, number] => [((lon + 180) / 360) * ATLAS_W, ((90 - lat) / 180) * ATLAS_H];

/**
 * Trace one polygon ring. Rings that cross the antimeridian are unwrapped so they
 * stay continuous, then drawn a second time shifted by a full map width.
 */
function traceRing(ctx: Paintable, ring: Position[]): void {
  const lons: number[] = [];
  let offset = 0;
  for (let i = 0; i < ring.length; i++) {
    if (i > 0) {
      const d = ring[i][0] - ring[i - 1][0];
      if (d > 180) offset -= 360;
      else if (d < -180) offset += 360;
    }
    lons.push(ring[i][0] + offset);
  }
  const min = Math.min(...lons);
  const max = Math.max(...lons);
  const shifts = [0];
  if (min < -180) shifts.push(360);
  if (max > 180) shifts.push(-360);
  for (const s of shifts) {
    ring.forEach((p, i) => {
      const [x, y] = project(lons[i] + s, p[1]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }
}

export function traceGeometry(ctx: Paintable, geom: Geometry): void {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  for (const poly of polys) for (const ring of poly) traceRing(ctx, ring);
}

/**
 * The full base atlas: ocean, graticule, coastline halo, pastel nations and the
 * playable nations in their own colours (at idle opacity).
 */
export function paintBase(ctx: Paintable, features: CountryFeature[], playable: Map<string, string>): void {
  // Ocean: deep at the poles, bright turquoise near the equator.
  const ocean = ctx.createLinearGradient(0, 0, 0, ATLAS_H);
  ocean.addColorStop(0, '#1e3a8a');
  ocean.addColorStop(0.3, '#2563eb');
  ocean.addColorStop(0.5, '#0ea5e9');
  ocean.addColorStop(0.7, '#2563eb');
  ocean.addColorStop(1, '#1e3a8a');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, ATLAS_W, ATLAS_H);

  // Graticule for an old-atlas feel.
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  for (let lon = -180; lon <= 180; lon += 15) {
    const [x] = project(lon, 0);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ATLAS_H);
    ctx.stroke();
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    const [, y] = project(0, lat);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(ATLAS_W, y);
    ctx.stroke();
  }

  // Shallow-water halo around every coastline.
  ctx.save();
  ctx.strokeStyle = 'rgba(165, 243, 252, 0.35)';
  ctx.lineWidth = 14;
  ctx.lineJoin = 'round';
  for (const f of features) {
    if (!f.geometry) continue;
    ctx.beginPath();
    traceGeometry(ctx, f.geometry);
    ctx.stroke();
  }
  ctx.restore();

  for (const f of features) {
    if (!f.geometry) continue;
    const id = String(f.id ?? f.properties?.name);
    const colour = playable.get(id);
    ctx.beginPath();
    traceGeometry(ctx, f.geometry);
    ctx.fillStyle = colour ?? PASTELS[hash(id) % PASTELS.length];
    ctx.globalAlpha = colour ? IDLE_ALPHA : 1;
    ctx.fill('evenodd');
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/** Draw a route country at full colour with a bold outline, over the base atlas. */
export function paintEmphasis(ctx: Paintable, f: CountryFeature, colour: string): void {
  if (!f.geometry) return;
  ctx.beginPath();
  traceGeometry(ctx, f.geometry);
  ctx.fillStyle = colour;
  ctx.fill('evenodd');
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.stroke();
}
