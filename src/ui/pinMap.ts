import type { Country } from '../data/countries';
import { traceGeometry, ATLAS_H, ATLAS_W, type CountryFeature, type Paintable } from '../three/atlasPaint';
import shapes from '../three/generated/game-shapes.json';
import atlasUrl from '../three/generated/world.webp?url';

/**
 * The "tap where X is" map: a crop of the baked world atlas around one country,
 * with everything outside the country dimmed.
 */

const SHAPES = new Map((shapes.features as unknown as CountryFeature[]).map((f) => [String(f.id), f]));

let atlas: Promise<HTMLImageElement> | null = null;
function loadAtlas(): Promise<HTMLImageElement> {
  atlas ??= new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = atlasUrl;
  });
  return atlas;
}

export interface LatLon {
  lat: number;
  lon: number;
}

export interface PinMap {
  reveal(target: LatLon, guess: LatLon, radiusKm: number, correct: boolean): void;
}

export function mountPinMap(host: HTMLElement, country: Country, onPick: (p: LatLon) => void): PinMap {
  const [s, n, w, e] = country.mapView;
  // Equirectangular crop, squashed horizontally by cos(latitude) so shapes look right.
  const midLat = ((s + n) / 2) * (Math.PI / 180);
  const aspect = ((e - w) * Math.cos(midLat)) / (n - s);
  const cssW = Math.min(host.clientWidth || 440, 460);
  const cssH = Math.round(Math.min(cssW / aspect, 360));
  const width = Math.round(cssH * aspect);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${cssH}px`;
  canvas.className = 'pin-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `Map of ${country.name}. Tap a location.`);
  host.replaceChildren(canvas);
  const ctx = canvas.getContext('2d')!;

  const toXY = (lat: number, lon: number): [number, number] => [((lon - w) / (e - w)) * canvas.width, ((n - lat) / (n - s)) * canvas.height];
  const toLatLon = (x: number, y: number): LatLon => ({ lon: w + (x / canvas.width) * (e - w), lat: n - (y / canvas.height) * (n - s) });

  // Path in canvas space: reuse the atlas tracer through a coordinate-mapping proxy.
  const mapped: Paintable = new Proxy(ctx as unknown as Paintable, {
    get(target, prop) {
      if (prop === 'moveTo' || prop === 'lineTo') {
        return (ax: number, ay: number) => {
          const lon = (ax / ATLAS_W) * 360 - 180;
          const lat = 90 - (ay / ATLAS_H) * 180;
          const [x, y] = toXY(lat, lon);
          (ctx[prop] as (x: number, y: number) => void).call(ctx, x, y);
        };
      }
      const v = (target as unknown as Record<string | symbol, unknown>)[prop];
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(ctx) : v;
    },
  });
  const tracePath = () => {
    const f = SHAPES.get(country.iso);
    ctx.beginPath();
    if (f?.geometry) traceGeometry(mapped, f.geometry);
  };

  let base: HTMLImageElement | null = null;
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!base) {
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const sx = ((w + 180) / 360) * base.naturalWidth;
    const sy = ((90 - n) / 180) * base.naturalHeight;
    const sw = ((e - w) / 360) * base.naturalWidth;
    const sh = ((n - s) / 180) * base.naturalHeight;
    ctx.drawImage(base, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    // Dim the neighbours, then bring the country back to full brightness.
    ctx.fillStyle = 'rgba(15, 10, 45, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    tracePath();
    ctx.clip('evenodd');
    ctx.drawImage(base, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    tracePath();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();
  };
  draw();
  loadAtlas()
    .then((img) => {
      base = img;
      draw();
    })
    .catch(() => {});

  let picked = false;
  canvas.addEventListener('click', (ev) => {
    if (picked) return;
    picked = true;
    const rect = canvas.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((ev.clientY - rect.top) / rect.height) * canvas.height;
    onPick(toLatLon(x, y));
  });

  return {
    reveal(target, guess, radiusKm, correct) {
      picked = true;
      draw();
      const [tx, ty] = toXY(target.lat, target.lon);
      const [gx, gy] = toXY(guess.lat, guess.lon);
      const pxPerKm = canvas.height / (n - s) / 111;
      // Target zone.
      ctx.beginPath();
      ctx.arc(tx, ty, radiusKm * pxPerKm, 0, Math.PI * 2);
      ctx.fillStyle = correct ? 'rgba(34, 197, 94, 0.25)' : 'rgba(253, 224, 71, 0.22)';
      ctx.fill();
      ctx.lineWidth = 2 * dpr;
      ctx.strokeStyle = correct ? '#22c55e' : '#fde047';
      ctx.setLineDash([6 * dpr, 5 * dpr]);
      ctx.stroke();
      // Line from guess to target.
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(tx, ty);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.stroke();
      ctx.setLineDash([]);
      const dot = (x: number, y: number, fill: string) => {
        ctx.beginPath();
        ctx.arc(x, y, 7 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = 3 * dpr;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      };
      dot(gx, gy, correct ? '#22c55e' : '#f43f5e');
      dot(tx, ty, '#fde047');
    },
  };
}
