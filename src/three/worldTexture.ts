import * as THREE from 'three';
import { ATLAS_H, ATLAS_W, paintEmphasis, type CountryFeature, type Paintable } from './atlasPaint';
import shapes from './generated/game-shapes.json';
import atlasUrl from './generated/world.webp?url';

export interface Highlight {
  color: string;
  /** Emphasised (on the active route). */
  strong: boolean;
}

const SHAPES = new Map((shapes.features as unknown as CountryFeature[]).map((f) => [String(f.id), f]));

/**
 * The globe texture: the atlas baked at build time (scripts/bake-globe.ts), with the
 * active route's nations repainted at full colour on top.
 */
export function createWorldTexture(highlights: Map<string, Highlight>): {
  texture: THREE.CanvasTexture;
  repaint: (h: Map<string, Highlight>) => void;
} {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W;
  canvas.height = ATLAS_H;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  let base: HTMLImageElement | null = null;
  let current = highlights;

  const paint = () => {
    if (base) {
      ctx.drawImage(base, 0, 0, ATLAS_W, ATLAS_H);
    } else {
      // Plain ocean until the atlas arrives (it is usually cached after the first visit).
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(0, 0, ATLAS_W, ATLAS_H);
    }
    for (const [iso, hl] of current) {
      const f = SHAPES.get(iso);
      if (base && hl.strong && f) paintEmphasis(ctx as unknown as Paintable, f, hl.color);
    }
    texture.needsUpdate = true;
  };

  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    base = img;
    paint();
  };
  img.src = atlasUrl;
  paint();

  return {
    texture,
    repaint(h) {
      current = h;
      paint();
    },
  };
}
