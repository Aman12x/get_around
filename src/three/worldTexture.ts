import * as THREE from 'three';
import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry, Position } from 'geojson';
import type { Topology, GeometryCollection } from 'topojson-specification';
import world from 'world-atlas/countries-50m.json';

const W = 4096;
const H = 2048;

const PASTELS = ['#a7e8bd', '#fde9a9', '#fbc7b5', '#d4c8fb', '#b6dcfb', '#fcd2a8', '#b4efe2', '#f8c6e0', '#d9f2a5'];

const topo = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const countries = feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const project = (lon: number, lat: number): [number, number] => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];

/**
 * Trace one polygon ring. Rings that cross the antimeridian are unwrapped so they
 * stay continuous, then drawn a second time shifted by a full map width.
 */
function traceRing(ctx: CanvasRenderingContext2D, ring: Position[]): void {
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

function tracePolygonGeometry(ctx: CanvasRenderingContext2D, geom: Geometry): void {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  for (const poly of polys) for (const ring of poly) traceRing(ctx, ring);
}

export interface Highlight {
  color: string;
  /** Emphasised (on the active route). */
  strong: boolean;
}

/** Paint a stylised, colourful atlas onto a canvas texture. */
export function paintWorld(canvas: HTMLCanvasElement, highlights: Map<string, Highlight>): void {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Ocean: deep at the poles, bright turquoise near the equator.
  const ocean = ctx.createLinearGradient(0, 0, 0, H);
  ocean.addColorStop(0, '#1e3a8a');
  ocean.addColorStop(0.3, '#2563eb');
  ocean.addColorStop(0.5, '#0ea5e9');
  ocean.addColorStop(0.7, '#2563eb');
  ocean.addColorStop(1, '#1e3a8a');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, W, H);

  // Graticule for an old-atlas feel.
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  for (let lon = -180; lon <= 180; lon += 15) {
    const [x] = project(lon, 0);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    const [, y] = project(0, lat);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Shallow-water halo around every coastline.
  ctx.save();
  ctx.strokeStyle = 'rgba(165, 243, 252, 0.35)';
  ctx.lineWidth = 14;
  ctx.lineJoin = 'round';
  for (const f of countries.features) {
    if (!f.geometry) continue;
    ctx.beginPath();
    tracePolygonGeometry(ctx, f.geometry);
    ctx.stroke();
  }
  ctx.restore();

  const strong: typeof countries.features = [];
  for (const f of countries.features) {
    if (!f.geometry) continue;
    const id = String(f.id ?? f.properties.name);
    const hl = highlights.get(id);
    ctx.beginPath();
    tracePolygonGeometry(ctx, f.geometry);
    ctx.fillStyle = hl ? hl.color : PASTELS[hash(id) % PASTELS.length];
    ctx.globalAlpha = hl && !hl.strong ? 0.75 : 1;
    ctx.fill('evenodd');
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (hl?.strong) strong.push(f);
  }

  // Bold outline for countries on the active route.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  for (const f of strong) {
    ctx.beginPath();
    tracePolygonGeometry(ctx, f.geometry);
    ctx.stroke();
  }
}

export function createWorldTexture(highlights: Map<string, Highlight>): {
  texture: THREE.CanvasTexture;
  repaint: (h: Map<string, Highlight>) => void;
} {
  const canvas = document.createElement('canvas');
  paintWorld(canvas, highlights);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return {
    texture,
    repaint(h) {
      paintWorld(canvas, h);
      texture.needsUpdate = true;
    },
  };
}
