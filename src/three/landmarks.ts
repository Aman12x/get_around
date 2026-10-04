import * as THREE from 'three';
import type { CountryId } from '../data/countries';
import {
  blossom,
  box,
  cactus,
  cone,
  cyl,
  cypress,
  group,
  mat,
  mesh,
  palm,
  place,
  rng,
  rock,
  roundTree,
  sphere,
  strut,
  water,
} from './kit';
import { WORLD_BUILDERS } from './landmarksWorld';

/**
 * Procedural low-poly landmarks, one per nation. Each builder returns a group that
 * sits on a flat island top (y = 0) with a footprint of roughly radius 4.5.
 *
 * These are deliberately code-built so the game ships with zero binary assets; any of
 * them can later be swapped for a hand-made glTF model with the same footprint.
 */
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function egypt(): THREE.Group {
  const sand = '#f2c46d';
  const stone = '#e9b35f';
  const g = group(
    place(cone(2.5, 3.3, 4, stone), -0.4, 0, -0.9, Math.PI / 4),
    place(cone(0.38, 0.5, 4, '#fde68a'), -0.4, 2.8, -0.9, Math.PI / 4),
    place(cone(1.8, 2.4, 4, '#e2a957'), 2.0, 0, 0.9, Math.PI / 4),
    place(cone(1.05, 1.4, 4, '#d99a48'), 2.7, 0, -2.0, Math.PI / 4),
    // Sphinx
    group(
      box(0.5, 0.42, 1.2, sand, 0, 0, 0),
      box(0.42, 0.45, 0.4, sand, 0, 0.35, 0.55),
      box(0.5, 0.3, 0.08, '#2563eb', 0, 0.5, 0.55),
      box(0.15, 0.12, 0.5, sand, -0.15, 0, 0.75),
      box(0.15, 0.12, 0.5, sand, 0.15, 0, 0.75),
    ),
    water(0.9, 7, -3.4, 0, '#22d3ee'),
  );
  g.children[g.children.length - 2].position.set(-1.9, 0, 2.1);
  for (const [x, z, h] of [
    [-2.6, 2.6, 1.3],
    [-2.7, -1.5, 1.5],
    [-2.5, 0.6, 1.1],
    [0.6, 3.1, 1.1],
  ]) {
    g.add(place(palm(h, 0.25), x, 0, z, x * z));
  }
  return g;
}

function greece(): THREE.Group {
  const marble = '#f7f1e3';
  const shade = '#e9dcc0';
  const g = group(
    box(3.8, 0.2, 5.6, shade, 0, 0, 0),
    box(3.5, 0.2, 5.3, marble, 0, 0.2, 0),
    box(3.2, 0.2, 5.0, shade, 0, 0.4, 0),
  );
  const colH = 1.9;
  const y0 = 0.6;
  const xs = [-1.4, -0.84, -0.28, 0.28, 0.84, 1.4];
  const zs = [-2.25, -1.6, -0.95, -0.32, 0.32, 0.95, 1.6, 2.25];
  const cols: Array<[number, number]> = [];
  for (const x of xs) cols.push([x, -2.25], [x, 2.25]);
  for (const z of zs.slice(1, -1)) cols.push([-1.4, z], [1.4, z]);
  for (const [x, z] of cols) g.add(cyl(0.13, 0.15, colH, 10, marble, x, y0, z), box(0.34, 0.08, 0.34, marble, x, y0 + colH - 0.08, z));
  g.add(box(3.25, 0.32, 5.0, marble, 0, y0 + colH, 0));
  g.add(box(3.25, 0.1, 5.05, '#3b82f6', 0, y0 + colH + 0.32, 0));
  const roof = mesh(new THREE.CylinderGeometry(1.9, 1.9, 5.1, 3), mat('#f1e4c6'));
  roof.rotation.x = -Math.PI / 2;
  roof.scale.set(1, 1, 0.28);
  roof.position.set(0, y0 + colH + 0.42 + 0.27, 0);
  g.add(roof);
  // Fallen column drums and olive trees.
  g.add(place(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 10), mat(marble)), 2.4, 0.15, 1.8, 0.6));
  (g.children.at(-1) as THREE.Mesh).rotation.z = Math.PI / 2;
  g.add(place(cyl(0.15, 0.15, 0.35, 10, marble), 2.6, 0, 2.5));
  for (const [x, z] of [
    [-2.8, 1.8],
    [-2.9, -1.2],
    [2.9, -1.6],
    [2.7, 0.2],
  ]) {
    g.add(place(roundTree('#84cc16', '#78716c', 0.9), x, 0, z));
  }
  return g;
}

function italy(): THREE.Group {
  const trav = '#e8c39e';
  const dark = '#7c4a2a';
  const g = new THREE.Group();
  const a = 2.6;
  const b = 2.1;
  const tierH = 0.75;
  const ellipse = (r: number, h: number, y: number, start = 0, len = Math.PI * 2, open = true) => {
    const m = mesh(new THREE.CylinderGeometry(r, r, h, 48, 1, open, start, len), mat(trav, { side: THREE.DoubleSide }));
    m.scale.z = b / a;
    m.position.y = y + h / 2;
    return m;
  };
  // Outer wall: full lower two tiers, the top two tiers broken away on one side.
  g.add(ellipse(a, tierH * 2, 0), ellipse(a, tierH * 2, tierH * 2, 0.6, Math.PI * 1.45));
  g.add(ellipse(a * 0.82, tierH * 2.2, 0));
  const floor = mesh(new THREE.CylinderGeometry(a * 0.6, a * 0.6, 0.08, 32), mat('#f5d79e'));
  floor.scale.z = b / a;
  floor.position.y = 0.04;
  g.add(floor);
  // Arches as dark recesses on each tier.
  const n = 32;
  for (let tier = 0; tier < 4; tier++) {
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      // Skip the ruined section on the upper tiers.
      const inRuin = tier >= 2 && !(t >= 0.6 && t <= 0.6 + Math.PI * 1.45);
      if (inRuin) continue;
      const x = Math.sin(t) * (a + 0.01);
      const z = Math.cos(t) * (b + 0.01);
      const arch = box(0.22, tier === 3 ? 0.18 : 0.42, 0.04, dark, x, tier * tierH + 0.12, z);
      arch.lookAt(x * 2, arch.position.y, z * 2);
      g.add(arch);
    }
    g.add(
      Object.assign(ellipse(a + 0.04, 0.07, tier * tierH + (tier ? 0 : tierH - 0.07)), {}),
    );
  }
  for (const [x, z] of [
    [-3.6, 1.6],
    [-3.3, 2.5],
    [3.4, 2.2],
    [3.7, -1.2],
    [-3.5, -1.8],
  ]) {
    g.add(place(cypress(1.7), x, 0, z));
  }
  return g;
}

function france(): THREE.Group {
  const iron = '#9a5b3c';
  const lattice = mat('#c98b5e', { wireframe: true });
  const g = new THREE.Group();
  const legBase = 1.5;
  const legTop = 0.62;
  const p1 = 1.5;
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
    g.add(strut(V(sx * legBase, 0, sz * legBase), V(sx * legTop, p1, sz * legTop), 0.2, iron));
  }
  for (let i = 0; i < 4; i++) {
    const arch = mesh(new THREE.TorusGeometry(0.95, 0.06, 6, 16, Math.PI), mat(iron));
    arch.position.set(0, 0.25, 0);
    arch.rotation.y = (i * Math.PI) / 2;
    arch.translateZ(1.2);
    g.add(arch);
  }
  g.add(box(1.9, 0.18, 1.9, iron, 0, p1, 0));
  const sec2 = mesh(new THREE.CylinderGeometry(0.42, 0.82, 1.6, 4), mat(iron));
  sec2.rotation.y = Math.PI / 4;
  sec2.position.y = p1 + 0.98;
  const sec2l = new THREE.Mesh(sec2.geometry, lattice);
  sec2l.scale.setScalar(1.06);
  sec2.add(sec2l);
  g.add(sec2, box(1.15, 0.14, 1.15, iron, 0, p1 + 1.78, 0));
  const sec3 = mesh(new THREE.CylinderGeometry(0.1, 0.42, 2.4, 4), mat(iron));
  sec3.rotation.y = Math.PI / 4;
  sec3.position.y = p1 + 1.92 + 1.2;
  const sec3l = new THREE.Mesh(sec3.geometry, lattice);
  sec3l.scale.setScalar(1.08);
  sec3.add(sec3l);
  g.add(sec3, box(0.32, 0.25, 0.32, '#fbbf24', 0, p1 + 4.25, 0), cyl(0.02, 0.03, 0.7, 4, iron, 0, p1 + 4.5, 0));
  // Champ de Mars: lawns, flowerbeds and café parasols.
  g.add(box(1.2, 0.04, 3.2, '#4ade80', 0, 0, 3.0));
  for (const [x, z, c] of [
    [-2.8, 2.4, '#ef4444'],
    [-3.2, 1.2, '#3b82f6'],
    [2.9, 2.6, '#ef4444'],
    [3.3, 1.3, '#f8fafc'],
  ] as const) {
    g.add(cyl(0.02, 0.02, 0.7, 4, '#475569', x, 0, z), cone(0.45, 0.25, 8, c, x, 0.65, z), cyl(0.25, 0.25, 0.05, 8, '#f8fafc', x, 0.35, z));
  }
  for (const [x, z] of [
    [-3, -2],
    [3.1, -1.8],
    [-3.6, -0.3],
    [3.6, -0.2],
  ]) {
    g.add(place(roundTree('#22c55e', '#7c4a1e', 0.9), x, 0, z));
  }
  return g;
}

function uk(): THREE.Group {
  const sand = '#d9b56f';
  const slate = '#334155';
  const g = new THREE.Group();
  const tx = -1.2;
  g.add(box(1.0, 3.6, 1.0, sand, tx, 0, 0), box(1.18, 1.0, 1.18, '#e7c886', tx, 3.6, 0));
  for (let i = 0; i < 4; i++) {
    const face = new THREE.Group();
    const dial = mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.05, 20), mat('#fffbeb', { emissive: '#fef3c7', emissiveIntensity: 0.4 }));
    dial.rotation.x = Math.PI / 2;
    face.add(dial, box(0.04, 0.3, 0.03, '#111827', 0, -0.02, 0.04), box(0.22, 0.04, 0.03, '#111827', 0.09, 0, 0.04));
    face.position.set(0, 4.1, 0.6);
    const pivot = group(face);
    pivot.rotation.y = (i * Math.PI) / 2;
    pivot.position.x = tx;
    g.add(pivot);
  }
  g.add(box(0.95, 0.55, 0.95, sand, tx, 4.6, 0));
  g.add(place(cone(0.78, 1.7, 4, slate), tx, 5.15, 0, Math.PI / 4));
  g.add(cyl(0.02, 0.04, 0.35, 6, '#fbbf24', tx, 6.8, 0));
  // Palace of Westminster wing with pinnacles.
  g.add(box(3.6, 1.5, 1.1, sand, 1.4, 0, 0.1), box(3.6, 0.25, 1.1, '#c69c55', 1.4, 1.5, 0.1));
  for (let i = 0; i < 7; i++) g.add(place(cone(0.08, 0.45, 4, slate), -0.3 + i * 0.57, 1.75, 0.6, Math.PI / 4));
  for (let i = 0; i < 6; i++) g.add(box(0.18, 0.45, 0.02, '#475569', -0.05 + i * 0.58, 0.55, 0.66));
  // The Thames, a red bus and a phone box.
  g.add(water(8, 1.2, 0, 2.6, '#38bdf8'));
  const bus = group(
    box(1.3, 0.75, 0.5, '#dc2626', 0, 0.08, 0),
    box(1.22, 0.14, 0.52, '#1e293b', 0, 0.3, 0),
    box(1.22, 0.14, 0.52, '#1e293b', 0, 0.6, 0),
  );
  for (const [x, z] of [
    [-0.4, 0.25],
    [0.4, 0.25],
    [-0.4, -0.25],
    [0.4, -0.25],
  ]) {
    const w = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 10), mat('#111827'), x, 0.11, z);
    w.rotation.x = Math.PI / 2;
    bus.add(w);
  }
  g.add(place(bus, 1.0, 0, 1.55), box(0.3, 0.7, 0.3, '#ef4444', -2.6, 0, 1.4), box(0.34, 0.06, 0.34, '#b91c1c', -2.6, 0.7, 1.4));
  for (const [x, z] of [
    [-3, -1.8],
    [3.4, -1.6],
    [-3.4, 0.2],
  ]) {
    g.add(place(roundTree('#16a34a', '#7c4a1e', 1), x, 0, z));
  }
  return g;
}

function onionDome(r: number, color: string): THREE.Mesh {
  const prof = [
    [0, 0],
    [0.78, 0],
    [0.98, 0.35],
    [0.95, 0.7],
    [0.7, 1.05],
    [0.32, 1.35],
    [0.08, 1.6],
    [0, 1.72],
  ].map(([x, y]) => new THREE.Vector2(x * r, y * r));
  return mesh(new THREE.LatheGeometry(prof, 14), color);
}

function india(): THREE.Group {
  const marble = '#fbf7f0';
  const inlay = '#e7d9c6';
  const gold = '#f59e0b';
  const g = group(box(4.6, 0.3, 4.6, '#f3e8d8', 0, 0, -0.4));
  const main = mesh(new THREE.CylinderGeometry(1.45, 1.45, 1.7, 8), mat(marble));
  main.rotation.y = Math.PI / 8;
  main.position.set(0, 0.3 + 0.85, -0.4);
  g.add(main);
  for (let i = 0; i < 4; i++) {
    const iwan = box(0.7, 1.1, 0.06, inlay, 0, 0, 0);
    const p = group(iwan);
    iwan.position.set(0, 0.45, 1.36);
    p.rotation.y = (i * Math.PI) / 2;
    p.position.set(0, 0.3, -0.4);
    g.add(p);
  }
  g.add(cyl(0.72, 0.72, 0.35, 16, marble, 0, 2.0, -0.4));
  const dome = onionDome(0.85, marble);
  dome.position.set(0, 2.35, -0.4);
  g.add(dome, cyl(0.02, 0.03, 0.45, 6, gold, 0, 3.75, -0.4), sphere(0.06, gold, 0, 4.0, -0.4));
  for (const [x, z] of [
    [0.95, 0.95],
    [-0.95, 0.95],
    [0.95, -0.95],
    [-0.95, -0.95],
  ]) {
    const d = onionDome(0.28, marble);
    d.position.set(x, 2.25, z - 0.4);
    g.add(cyl(0.22, 0.22, 0.25, 8, marble, x, 2.0, z - 0.4), d);
  }
  for (const [x, z] of [
    [2.1, 1.7],
    [-2.1, 1.7],
    [2.1, -2.5],
    [-2.1, -2.5],
  ]) {
    g.add(cyl(0.12, 0.16, 2.6, 8, marble, x, 0.3, z));
    for (const y of [1.1, 1.9, 2.8]) g.add(cyl(0.22, 0.22, 0.06, 8, inlay, x, y, z));
    const d = onionDome(0.17, marble);
    d.position.set(x, 2.9, z);
    g.add(d);
  }
  // Reflecting pool lined with cypresses.
  g.add(water(0.7, 2.6, 0, 3.3, '#7dd3fc'));
  for (const z of [2.3, 3.0, 3.7, 4.3]) g.add(place(cypress(1.1, '#15803d'), -0.85, 0, z), place(cypress(1.1, '#15803d'), 0.85, 0, z));
  g.add(place(roundTree('#4ade80', '#7c4a1e', 0.9), -3.4, 0, 2.2), place(roundTree('#4ade80', '#7c4a1e', 0.9), 3.4, 0, 2.2));
  return g;
}

function china(): THREE.Group {
  const red = '#dc2626';
  const roof = '#0f766e';
  const gold = '#fbbf24';
  const g = new THREE.Group();
  let y = 0;
  g.add(box(2.4, 0.3, 2.4, '#e7e5e4', -0.6, 0, -0.6));
  y = 0.3;
  for (let i = 0; i < 5; i++) {
    const w = 1.5 - i * 0.2;
    const h = 0.62 - i * 0.04;
    g.add(box(w, h, w, red, -0.6, y, -0.6));
    g.add(box(w * 0.7, h * 0.5, w + 0.02, '#7f1d1d', -0.6, y + h * 0.2, -0.6));
    const r = mesh(new THREE.ConeGeometry(w * 0.98, 0.42, 4), mat(roof));
    r.rotation.y = Math.PI / 4;
    r.position.set(-0.6, y + h + 0.17, -0.6);
    g.add(r, box(w * 1.36, 0.05, w * 1.36, gold, -0.6, y + h - 0.02, -0.6));
    y += h + 0.32;
  }
  g.add(cyl(0.02, 0.06, 0.8, 6, gold, -0.6, y, -0.6), sphere(0.08, gold, -0.6, y + 0.4, -0.6));
  // The Great Wall snaking along the island's rim, with watchtowers.
  const stone = '#c8b48f';
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 26; i++) {
    const t = -0.2 + (i / 26) * 2.6;
    const r = 3.7 + Math.sin(i * 0.7) * 0.25;
    pts.push(V(Math.cos(t) * r, 0, Math.sin(t) * r));
  }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const seg = box(a.distanceTo(b) + 0.06, 0.55, 0.38, stone, 0, 0, 0);
    const holder = group(seg);
    holder.position.copy(mid);
    holder.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    holder.add(box(0.12, 0.12, 0.08, stone, -0.1, 0.55, 0.15), box(0.12, 0.12, 0.08, stone, 0.15, 0.55, 0.15));
    g.add(holder);
    if (i % 6 === 0) g.add(box(0.7, 0.95, 0.7, '#b8a07a', b.x, 0, b.z), box(0.8, 0.1, 0.8, roof, b.x, 0.95, b.z));
  }
  // Lanterns and plum blossom trees.
  for (const [x, z] of [
    [1.0, -2.6],
    [-2.8, 0.8],
  ]) {
    g.add(place(blossom(1), x, 0, z));
  }
  for (const [x, z] of [
    [0.5, 1.2],
    [-1.6, 1.4],
  ]) {
    g.add(cyl(0.02, 0.02, 1.2, 4, '#44403c', x, 0, z), sphere(0.16, mat(red, { emissive: '#f97316', emissiveIntensity: 0.6 }), x, 1.15, z, 1));
  }
  return g;
}

function japan(): THREE.Group {
  const vermilion = '#e8432e';
  const g = new THREE.Group();
  g.add(cone(2.9, 3.4, 14, '#6d7fbf', 0, 0, -1.8));
  g.add(cone(1.05, 1.24, 14, '#f8fafc', 0, 3.4 - 1.24 + 0.02, -1.8));
  const torii = group(
    cyl(0.09, 0.11, 1.8, 10, vermilion, -0.75, 0, 0),
    cyl(0.09, 0.11, 1.8, 10, vermilion, 0.75, 0, 0),
    box(1.85, 0.12, 0.16, vermilion, 0, 1.42, 0),
    box(2.3, 0.12, 0.26, vermilion, 0, 1.78, 0),
    box(2.4, 0.08, 0.3, '#1f2937', 0, 1.9, 0),
    box(0.12, 0.38, 0.1, vermilion, 0, 1.45, 0),
  );
  g.add(place(torii, 0, 0, 1.4));
  for (const [x, z, s] of [
    [-2.6, 1.0, 1.1],
    [2.5, 1.4, 1.0],
    [-3.0, -0.6, 0.9],
    [3.1, -0.4, 1.2],
    [-1.5, 2.8, 0.8],
  ]) {
    g.add(place(blossom(s), x, 0, z));
  }
  // Koi pond and stone lantern.
  const pond = mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.06, 20), mat('#38bdf8', { roughness: 0.1 }), 1.7, 0.03, 2.6);
  g.add(pond, sphere(0.08, '#fb923c', 1.5, 0.08, 2.5), sphere(0.08, '#f8fafc', 1.9, 0.08, 2.8));
  g.add(
    cyl(0.08, 0.12, 0.5, 6, '#a8a29e', -0.4, 0, 3.2),
    box(0.3, 0.22, 0.3, '#d6d3d1', -0.4, 0.5, 3.2),
    cone(0.28, 0.2, 4, '#78716c', -0.4, 0.72, 3.2),
  );
  return g;
}

function usa(): THREE.Group {
  const copper = '#5fb3a1';
  const granite = '#cdbf9f';
  const g = new THREE.Group();
  g.add(place(box(2.6, 0.4, 2.6, '#a8a29e', 0, 0, 0), 0, 0, 0, Math.PI / 4), box(2.6, 0.4, 2.6, '#a8a29e', 0, 0, 0));
  g.add(box(1.5, 0.4, 1.5, granite, 0, 0.4, 0), box(1.1, 1.3, 1.1, granite, 0, 0.8, 0), box(1.25, 0.2, 1.25, '#e7dcc0', 0, 2.1, 0));
  const top = 2.3;
  g.add(cyl(0.3, 0.48, 1.5, 10, copper, 0, top, 0), cyl(0.24, 0.3, 0.55, 10, copper, 0, top + 1.5, 0));
  g.add(sphere(0.18, copper, 0, top + 2.2, 0, 1));
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + ((i - 3) / 6) * Math.PI * 0.9;
    const spike = mesh(new THREE.ConeGeometry(0.035, 0.32, 4), mat(copper));
    spike.position.set(Math.sin(a) * 0.2, top + 2.3, Math.cos(a) * 0.2 * -1);
    spike.lookAt(spike.position.clone().multiplyScalar(3).setY(top + 2.6));
    spike.rotateX(Math.PI / 2);
    g.add(spike);
  }
  // Raised torch arm and tablet.
  g.add(strut(V(0.25, top + 1.9, 0), V(0.42, top + 3.0, 0.05), 0.07, copper, 6));
  g.add(cyl(0.09, 0.06, 0.25, 8, '#fbbf24', 0.42, top + 3.0, 0.05));
  g.add(cone(0.12, 0.3, 6, mat('#fb923c', { emissive: '#f97316', emissiveIntensity: 1.2 }), 0.42, top + 3.25, 0.05));
  const tablet = box(0.3, 0.42, 0.08, copper, -0.32, top + 1.15, 0.12);
  tablet.rotation.z = 0.2;
  g.add(tablet);
  // Manhattan skyline behind.
  const r = rng(42);
  const glass = ['#60a5fa', '#818cf8', '#38bdf8', '#a5b4fc', '#c4b5fd'];
  for (let i = 0; i < 11; i++) {
    const x = -3.4 + i * 0.68;
    const h = 0.8 + r() * 1.6;
    g.add(box(0.5, h, 0.5, mat(glass[i % glass.length], { roughness: 0.3, metalness: 0.2 }), x, 0, -3.1 + r() * 0.4));
  }
  g.add(water(7.6, 1, 0, 2.9, '#38bdf8'));
  return g;
}

function mexico(): THREE.Group {
  const stone = '#d4c49f';
  const g = new THREE.Group();
  const tiers = 9;
  const th = 0.3;
  for (let i = 0; i < tiers; i++) {
    const w = 3.8 - i * 0.33;
    g.add(box(w, th, w, i % 2 ? stone : '#c8b68c', 0, i * th, 0));
  }
  const H = tiers * th;
  for (let s = 0; s < 4; s++) {
    const stair = new THREE.Group();
    for (let i = 0; i < tiers; i++) {
      const w = 3.8 - i * 0.33;
      stair.add(box(0.75, th, 0.33, '#ead9b0', 0, i * th, w / 2));
    }
    // Sloped balustrades ending in Kukulcán serpent heads.
    const topZ = (3.8 - (tiers - 1) * 0.33) / 2;
    for (const x of [-0.43, 0.43]) {
      stair.add(strut(V(x, 0.12, 2.05), V(x, H, topZ + 0.1), 0.07, '#bfae86'));
      stair.add(box(0.2, 0.22, 0.28, '#16a34a', x, 0, 2.1));
    }
    stair.rotation.y = (s * Math.PI) / 2;
    g.add(stair);
  }
  g.add(box(1.0, 0.75, 1.0, '#e7d7b0', 0, H, 0), box(0.3, 0.45, 0.04, '#44403c', 0, H, 0.5), box(1.15, 0.12, 1.15, '#b45309', 0, H + 0.75, 0));
  for (const [x, z, h] of [
    [-3.2, 2.0, 1.2],
    [3.0, 2.4, 1.0],
    [3.4, -1.8, 1.3],
    [-3.3, -2.0, 0.9],
  ]) {
    g.add(place(cactus(h), x, 0, z, x));
  }
  for (const [x, z] of [
    [-3.6, 0.2],
    [3.7, 0.4],
  ]) {
    g.add(place(roundTree('#22c55e', '#7c4a1e', 1.1), x, 0, z));
  }
  return g;
}

function brazil(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.35, 2.4, 3.3, 9, '#2f9e5b', 0, 0, -0.6), cyl(0.36, 0.5, 0.25, 9, '#64748b', 0, 3.3, -0.6));
  const white = '#f1f5f9';
  const t = 3.55;
  const christ = group(
    box(0.22, 0.25, 0.22, '#cbd5e1', 0, 0, 0),
    cyl(0.1, 0.17, 0.95, 8, white, 0, 0.25, 0),
    box(1.2, 0.11, 0.12, white, 0, 1.0, 0),
    sphere(0.09, white, 0, 1.32, 0, 1),
  );
  g.add(place(christ, 0, t, -0.6, 0, 1.6));
  // Sugarloaf Mountain.
  const loaf = mesh(new THREE.SphereGeometry(0.85, 10, 8), mat('#78716c'));
  loaf.scale.set(1, 1.9, 1);
  loaf.position.set(2.8, 0.2, 1.0);
  g.add(loaf, cyl(0.6, 0.95, 0.35, 8, '#22c55e', 2.8, 0, 1.0));
  // Colourful hillside houses.
  const colours = ['#f43f5e', '#facc15', '#22d3ee', '#a78bfa', '#fb923c', '#4ade80', '#f472b6'];
  const r = rng(7);
  for (let i = 0; i < 16; i++) {
    const a = Math.PI * (0.55 + r() * 0.6);
    const d = 2.1 + r() * 1.1;
    g.add(box(0.3, 0.25 + r() * 0.2, 0.3, colours[i % colours.length], Math.cos(a) * d, 0, Math.sin(a) * d - 0.6));
  }
  g.add(box(6.6, 0.05, 1.1, '#fde68a', 0, 0, 3.1));
  for (const [x, z] of [
    [-2.4, 2.6],
    [-0.6, 3.0],
    [1.2, 2.8],
    [-3.4, 1.0],
  ]) {
    g.add(place(palm(1.5, 0.3), x, 0, z, x));
  }
  return g;
}

const BUILDERS: Record<CountryId, () => THREE.Group> = {
  egypt,
  greece,
  italy,
  france,
  uk,
  india,
  china,
  japan,
  usa,
  mexico,
  brazil,
  ...WORLD_BUILDERS,
};

export function buildLandmark(id: CountryId): THREE.Group {
  const g = BUILDERS[id]();
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

export { rock };
