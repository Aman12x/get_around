import * as THREE from 'three';
import {
  acacia,
  balloon,
  birch,
  boat,
  box,
  cone,
  cyl,
  cypress,
  gable,
  group,
  house,
  mat,
  mesh,
  palm,
  pine,
  place,
  rock,
  roundTree,
  sphere,
  strut,
  water,
} from './kit';

/**
 * Landmarks for the Africa, Middle East, Nordic and Oceania routes. Same contract as
 * landmarks.ts: a group resting on y = 0 with a footprint of roughly radius 4.5.
 */
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function dome(r: number, color: string): THREE.Mesh {
  return mesh(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(color));
}

/** A Persian-style bulb dome (Lathe). */
function bulb(r: number, color: string): THREE.Mesh {
  const prof = [
    [0, 0],
    [0.92, 0],
    [1.05, 0.3],
    [1.0, 0.65],
    [0.75, 1.0],
    [0.35, 1.3],
    [0.06, 1.55],
    [0, 1.62],
  ].map(([x, y]) => new THREE.Vector2(x * r, y * r));
  return mesh(new THREE.LatheGeometry(prof, 16), color);
}

function minaret(h: number, color: string, tip: string, x: number, z: number): THREE.Group {
  return group(
    cyl(0.1, 0.13, h, 10, color, x, 0, z),
    cyl(0.2, 0.2, 0.06, 10, color, x, h * 0.72, z),
    cone(0.12, 0.5, 10, tip, x, h, z),
  );
}

function giraffe(): THREE.Group {
  const c = '#e9b04b';
  const g = group(box(0.7, 0.35, 0.28, c, 0, 0.75, 0));
  for (const [x, z] of [
    [-0.28, -0.1],
    [-0.28, 0.1],
    [0.28, -0.1],
    [0.28, 0.1],
  ]) {
    g.add(box(0.07, 0.75, 0.07, c, x, 0, z));
  }
  g.add(strut(V(0.3, 1.0, 0), V(0.6, 1.9, 0), 0.07, c, 5), box(0.3, 0.14, 0.14, c, 0.7, 1.86, 0));
  for (const [x, y] of [
    [-0.15, 0.95],
    [0.12, 0.88],
    [0.4, 1.35],
  ]) {
    g.add(box(0.1, 0.08, 0.3, '#92400e', x, y, 0));
  }
  return g;
}

function elephant(): THREE.Group {
  const c = '#9ca3af';
  const body = sphere(0.55, c, 0, 0.95, 0, 1);
  body.scale.set(1.3, 0.95, 0.85);
  const g = group(body, sphere(0.32, c, 0.75, 1.15, 0, 1));
  g.add(strut(V(0.95, 1.05, 0), V(1.08, 0.35, 0), 0.07, c, 6));
  for (const z of [-0.33, 0.33]) g.add(box(0.06, 0.45, 0.32, '#8b919b', 0.62, 0.95, z));
  for (const [x, z] of [
    [-0.35, -0.22],
    [-0.35, 0.22],
    [0.35, -0.22],
    [0.35, 0.22],
  ]) {
    g.add(cyl(0.12, 0.12, 0.55, 7, c, x, 0, z));
  }
  return g;
}

function camel(): THREE.Group {
  const c = '#c08a4d';
  const g = group(box(0.7, 0.3, 0.26, c, 0, 0.62, 0), sphere(0.2, c, -0.05, 0.98, 0));
  for (const [x, z] of [
    [-0.25, -0.08],
    [-0.25, 0.08],
    [0.25, -0.08],
    [0.25, 0.08],
  ]) {
    g.add(box(0.07, 0.62, 0.07, c, x, 0, z));
  }
  g.add(strut(V(0.3, 0.8, 0), V(0.52, 1.2, 0), 0.06, c, 5), box(0.26, 0.12, 0.12, c, 0.6, 1.15, 0));
  return g;
}

function sheep(): THREE.Group {
  const wool = sphere(0.22, '#f8fafc', 0, 0.3, 0, 1);
  wool.scale.set(1.3, 1, 1);
  return group(wool, box(0.14, 0.14, 0.12, '#1f2937', 0.3, 0.32, 0), box(0.05, 0.18, 0.05, '#1f2937', -0.12, 0, 0.08), box(0.05, 0.18, 0.05, '#1f2937', 0.12, 0, -0.08));
}

// ---------- Africa ----------

function morocco(): THREE.Group {
  const sand = '#d8a06a';
  const g = new THREE.Group();
  const tx = -0.6;
  const tz = -0.6;
  g.add(box(1.3, 4.2, 1.3, sand, tx, 0, tz));
  for (let side = 0; side < 4; side++) {
    const face = new THREE.Group();
    for (const y of [1.0, 2.1, 3.1]) face.add(box(0.36, 0.55, 0.04, '#a0623a', 0, y, 0.66));
    const pivot = group(face);
    pivot.rotation.y = (side * Math.PI) / 2;
    pivot.position.set(tx, 0, tz);
    g.add(pivot);
  }
  g.add(box(1.36, 0.25, 1.36, '#15803d', tx, 3.6, tz));
  for (const [dx, dz] of [
    [-0.5, -0.5],
    [0.5, -0.5],
    [-0.5, 0.5],
    [0.5, 0.5],
    [0, -0.5],
    [0, 0.5],
    [-0.5, 0],
    [0.5, 0],
  ]) {
    g.add(box(0.18, 0.22, 0.18, sand, tx + dx, 4.2, tz + dz));
  }
  g.add(box(0.6, 0.85, 0.6, sand, tx, 4.2, tz), cone(0.42, 0.45, 4, '#15803d', tx, 5.05, tz));
  for (let i = 0; i < 3; i++) g.add(sphere(0.09 - i * 0.015, '#fbbf24', tx, 5.6 + i * 0.17, tz, 1));
  // Kasbah wall, rugs and dunes.
  const wall = '#c2703d';
  g.add(box(3.4, 0.9, 0.35, wall, 1.6, 0, -2.2));
  for (let i = 0; i < 7; i++) g.add(box(0.22, 0.22, 0.35, wall, 0.1 + i * 0.5, 0.9, -2.2));
  for (const [x, z, c] of [
    [1.4, 0.6, '#b91c1c'],
    [2.2, 1.4, '#1d4ed8'],
    [0.9, 1.7, '#f59e0b'],
  ] as const) {
    g.add(box(0.8, 0.03, 0.5, c, x, 0, z));
  }
  for (const [x, z] of [
    [-3, 1.6],
    [-2.6, -2.4],
    [3.3, -0.4],
  ]) {
    g.add(place(palm(1.4, 0.25), x, 0, z, x));
  }
  for (const [x, z, s] of [
    [-2.3, 2.9, 1.1],
    [2.8, 2.4, 0.9],
  ]) {
    const d = sphere(s, '#f2c46d', x, 0, z, 1);
    d.scale.y = 0.35;
    g.add(d);
  }
  return g;
}

function nigeria(): THREE.Group {
  const g = new THREE.Group();
  const zuma = sphere(2.0, '#8d7b68', -0.8, 0.9, -1.0, 1);
  zuma.scale.set(1.25, 1.2, 0.95);
  g.add(zuma, sphere(0.9, '#7a6a59', 0.6, 0.3, -1.6, 1));
  for (const [x, y, z] of [
    [-1.2, 2.2, 0.6],
    [-0.4, 1.6, 0.85],
  ]) {
    g.add(box(0.5, 0.08, 0.06, '#5b4d40', x, y, z));
  }
  // Village of round huts with thatched roofs.
  for (const [x, z, s] of [
    [1.8, 1.2, 1],
    [2.8, 0.2, 0.9],
    [0.9, 2.5, 0.85],
    [2.6, 2.3, 0.8],
  ]) {
    g.add(cyl(0.45 * s, 0.5 * s, 0.6 * s, 10, '#b7774a', x, 0, z), cone(0.68 * s, 0.6 * s, 10, '#d6b26e', x, 0.6 * s, z));
    g.add(box(0.2 * s, 0.35 * s, 0.03, '#3f2a1d', x, 0, z + 0.49 * s));
  }
  // Market stall in green and white.
  g.add(cyl(0.03, 0.03, 0.8, 4, '#78350f', -2.4, 0, 2.0), cyl(0.03, 0.03, 0.8, 4, '#78350f', -1.4, 0, 2.0));
  for (let i = 0; i < 3; i++) g.add(box(0.36, 0.05, 0.9, i % 2 ? '#ffffff' : '#16a34a', -2.25 + i * 0.36, 0.8, 2.0));
  g.add(box(1.0, 0.35, 0.5, '#a16207', -1.9, 0, 2.0), sphere(0.12, '#f97316', -2.1, 0.45, 2.0), sphere(0.12, '#facc15', -1.75, 0.45, 2.0));
  for (const [x, z] of [
    [-3.2, 0],
    [3.4, -1.6],
    [-2.8, -2.6],
  ]) {
    g.add(place(palm(1.5, 0.2), x, 0, z, x));
  }
  return g;
}

function ethiopia(): THREE.Group {
  const stone = '#9c8f7a';
  const g = new THREE.Group();
  // Aksum stele with carved false windows and a rounded head.
  const sx = -1.4;
  const sz = -1.2;
  g.add(box(0.6, 4.4, 0.4, stone, sx, 0, sz));
  const head = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.4, 12, 1, false, 0, Math.PI), mat(stone));
  head.rotation.x = Math.PI / 2;
  head.rotation.z = Math.PI / 2;
  head.position.set(sx, 4.4, sz);
  g.add(head);
  for (let i = 0; i < 6; i++) g.add(box(0.16, 0.24, 0.03, '#6b6152', sx - 0.12, 0.6 + i * 0.62, sz + 0.21), box(0.16, 0.24, 0.03, '#6b6152', sx + 0.12, 0.6 + i * 0.62, sz + 0.21));
  g.add(box(0.9, 0.25, 0.7, '#a8a29e', sx, 0, sz));
  // Lalibela: a cross-shaped church carved down into the rock, inside its trench.
  const red = '#b45f2a';
  const lx = 1.4;
  const lz = 0.9;
  g.add(box(2.6, 0.08, 2.6, '#5a2d12', lx, 0, lz));
  for (const [dx, dz, w, d] of [
    [0, -1.35, 2.9, 0.25],
    [0, 1.35, 2.9, 0.25],
    [-1.35, 0, 0.25, 2.9],
    [1.35, 0, 0.25, 2.9],
  ]) {
    g.add(box(w, 0.4, d, '#8a4a22', lx + dx, 0, lz + dz));
  }
  g.add(box(1.9, 1.0, 0.7, red, lx, 0, lz), box(0.7, 1.0, 1.9, red, lx, 0, lz));
  g.add(box(1.0, 0.08, 0.28, '#d07a3e', lx, 1.0, lz), box(0.28, 0.08, 1.0, '#d07a3e', lx, 1.0, lz));
  for (const [x, z] of [
    [-3.2, 1.6],
    [3.3, -1.8],
    [-2.6, -2.8],
    [0.2, 3.3],
  ]) {
    g.add(place(roundTree('#4d7c0f', '#6b4423', 0.9), x, 0, z));
  }
  return g;
}

function kenya(): THREE.Group {
  const g = new THREE.Group();
  g.add(cone(2.3, 3.4, 7, '#64748b', -0.8, 0, -1.8), cone(1.2, 2.6, 6, '#475569', 0.6, 0, -2.2));
  g.add(cone(0.82, 1.2, 7, '#f8fafc', -0.8, 2.2, -1.8), cone(0.46, 1.0, 6, '#f8fafc', 0.6, 1.62, -2.2));
  for (const [x, z, s] of [
    [-2.6, 1.2, 1.2],
    [2.6, 1.6, 1.0],
    [3.0, -0.8, 1.1],
    [-3.2, -1.2, 0.9],
  ]) {
    g.add(place(acacia(s), x, 0, z, x));
  }
  g.add(place(giraffe(), 0.9, 0, 1.4, -0.6, 1.1), place(giraffe(), -0.6, 0, 2.2, 0.4, 0.9));
  g.add(place(elephant(), 1.9, 0, -0.1, 2.6, 0.9));
  return g;
}

function southAfrica(): THREE.Group {
  const g = new THREE.Group();
  const mtn = mesh(new THREE.CylinderGeometry(2.3, 2.9, 2.2, 9), mat('#7d8f6a'), 0, 1.1, -1.6);
  mtn.scale.z = 0.5;
  g.add(mtn, box(4.4, 0.1, 1.4, '#94a38a', 0, 2.2, -1.6));
  for (let i = 0; i < 5; i++) {
    const c = sphere(0.45, mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.4 }), -1.6 + i * 0.8, 2.45, -1.6, 1);
    c.scale.y = 0.45;
    g.add(c);
  }
  g.add(cone(0.9, 2.0, 7, '#6b7f5a', 2.9, 0, -0.9));
  // Bo-Kaap houses.
  const colours = ['#f472b6', '#a3e635', '#22d3ee', '#facc15', '#a78bfa', '#fb923c'];
  colours.forEach((c, i) => {
    g.add(box(0.55, 0.7, 0.55, c, -2.0 + i * 0.6, 0, 1.4), box(0.6, 0.08, 0.6, '#ffffff', -2.0 + i * 0.6, 0.7, 1.4));
    g.add(box(0.14, 0.26, 0.02, '#1f2937', -2.0 + i * 0.6, 0, 1.68));
  });
  // Lighthouse.
  g.add(cyl(0.22, 0.3, 1.8, 10, '#ffffff', 2.8, 0, 2.0));
  for (const y of [0.4, 1.1]) g.add(cyl(0.29, 0.29, 0.25, 10, '#dc2626', 2.8, y, 2.0));
  g.add(cyl(0.18, 0.18, 0.3, 8, mat('#fde68a', { emissive: '#fbbf24', emissiveIntensity: 1 }), 2.8, 1.8, 2.0), cone(0.26, 0.3, 8, '#dc2626', 2.8, 2.1, 2.0));
  g.add(water(5.5, 0.8, 0, 3.3, '#38bdf8'));
  return g;
}

// ---------- Middle East ----------

function turkey(): THREE.Group {
  const g = new THREE.Group();
  const walls = '#d98c6a';
  const lead = '#8aa0b8';
  g.add(box(2.8, 1.2, 2.8, walls, 0, 0, -0.4), box(2.0, 0.5, 2.0, walls, 0, 1.2, -0.4));
  const main = dome(1.05, lead);
  main.position.set(0, 1.7, -0.4);
  g.add(main, cyl(1.05, 1.05, 0.25, 16, walls, 0, 1.45, -0.4));
  for (const dz of [-1.0, 1.0]) {
    const half = mesh(new THREE.SphereGeometry(0.7, 14, 7, 0, Math.PI, 0, Math.PI / 2), mat(lead));
    half.position.set(0, 1.45, -0.4 + dz);
    half.rotation.y = dz > 0 ? 0 : Math.PI;
    g.add(half);
  }
  for (const [x, z] of [
    [1.7, 1.3],
    [-1.7, 1.3],
    [1.7, -2.1],
    [-1.7, -2.1],
  ]) {
    g.add(minaret(3.6, '#f1e7da', lead, x, z));
  }
  // Cappadocia: fairy chimneys and hot-air balloons.
  for (const [x, z, h] of [
    [3.0, 0.3, 1.2],
    [3.4, -1.0, 0.9],
    [2.8, 2.3, 1.0],
  ]) {
    g.add(cone(0.35, h, 8, '#e7cfa8', x, 0, z), cone(0.22, 0.2, 8, '#78716c', x, h - 0.05, z));
  }
  const balloons: Array<[number, number, number, string, string]> = [
    [-2.8, 4.6, 1.2, '#ef4444', '#fde047'],
    [2.6, 5.4, -1.8, '#3b82f6', '#f472b6'],
    [-1.4, 6.2, -2.8, '#22c55e', '#f97316'],
  ];
  for (const [x, y, z, a, b] of balloons) g.add(place(balloon(a, b), x, y, z, 0, 0.9));
  return g;
}

function jordan(): THREE.Group {
  const rose = '#e29a8e';
  const deep = '#b5655a';
  const g = new THREE.Group();
  g.add(box(6.4, 4.6, 1.8, deep, 0, 0, -2.0));
  for (const [x, y, s] of [
    [-2.6, 4.6, 0.8],
    [1.8, 4.6, 0.9],
    [0, 4.6, 0.6],
  ]) {
    g.add(place(rock(s, deep), x, y - 0.1, -2.0));
  }
  // The Treasury facade carved into the cliff.
  const fz = -1.05;
  g.add(box(3.2, 4.0, 0.12, rose, 0, 0, fz - 0.04));
  for (const x of [-1.2, -0.6, 0.6, 1.2]) g.add(cyl(0.12, 0.12, 1.7, 10, rose, x, 0, fz + 0.1));
  g.add(box(2.8, 0.25, 0.3, rose, 0, 1.7, fz + 0.08));
  const ped = gable(1.6, 0.5, 0.2, rose, 0, 1.95, fz + 0.08);
  g.add(ped, box(0.6, 1.2, 0.05, '#4a2620', 0, 0, fz + 0.12));
  g.add(cyl(0.38, 0.38, 1.1, 12, rose, 0, 2.6, fz + 0.1), cone(0.45, 0.45, 12, rose, 0, 3.7, fz + 0.1), sphere(0.1, rose, 0, 4.2, fz + 0.1));
  for (const x of [-1.15, 1.15]) {
    g.add(box(0.7, 1.1, 0.25, rose, x, 2.6, fz + 0.06), gable(0.75, 0.3, 0.25, rose, x, 3.7, fz + 0.06));
  }
  g.add(place(camel(), 1.6, 0, 1.4, 2.4), place(camel(), -1.8, 0, 1.9, 0.6, 0.9));
  for (const [x, z] of [
    [3.2, 0.5],
    [-3.3, -0.2],
    [0.4, 3.0],
  ]) {
    g.add(place(rock(0.3, '#d1897b'), x, 0, z));
  }
  return g;
}

function iran(): THREE.Group {
  const tile = '#0e7490';
  const turq = '#06b6d4';
  const g = new THREE.Group();
  g.add(box(3.2, 1.8, 2.4, '#e8d9b8', 0, 0, -1.4));
  g.add(cyl(1.0, 1.0, 1.0, 16, tile, 0, 1.8, -1.4));
  const d = bulb(1.2, turq);
  d.position.set(0, 2.8, -1.4);
  g.add(d, cyl(0.03, 0.04, 0.5, 6, '#fbbf24', 0, 4.7, -1.4), sphere(0.09, '#fbbf24', 0, 5.2, -1.4));
  // Iwan portal with its tall arch, flanked by minarets.
  g.add(box(2.0, 2.2, 0.6, tile, 0, 0, 0.3), box(0.9, 1.6, 0.08, '#164e63', 0, 0, 0.62), box(2.1, 0.16, 0.66, '#fbbf24', 0, 2.2, 0.3));
  for (const x of [-1.25, 1.25]) g.add(minaret(3.6, turq, tile, x, 0.3));
  // Persian garden: a long pool lined with cypresses.
  g.add(water(0.8, 2.6, 0, 2.3, '#67e8f9'));
  for (const z of [1.3, 2.1, 2.9, 3.6]) g.add(place(cypress(1.2, '#166534'), -0.9, 0, z), place(cypress(1.2, '#166534'), 0.9, 0, z));
  g.add(place(roundTree('#65a30d', '#6b4423', 0.9), -3.2, 0, 1.4), place(roundTree('#65a30d', '#6b4423', 0.9), 3.2, 0, 1.2));
  return g;
}

function uae(): THREE.Group {
  const glass = mat('#c7d2fe', { roughness: 0.25, metalness: 0.35 });
  const g = new THREE.Group();
  // Burj Khalifa: tapering stacked tiers and a spire.
  let y = 0;
  const tiers = [0.75, 0.66, 0.58, 0.5, 0.42, 0.35, 0.28, 0.21, 0.15];
  tiers.forEach((r, i) => {
    const h = 0.75 - i * 0.03;
    g.add(cyl(r * 0.92, r, h, 6, glass, -0.4, y, -0.6));
    y += h;
  });
  g.add(cyl(0.02, 0.08, 1.4, 6, glass, -0.4, y, -0.6));
  // Neighbouring towers.
  for (const [x, z, h, c] of [
    [1.2, -1.5, 2.4, '#93c5fd'],
    [1.9, -0.4, 1.7, '#a5b4fc'],
    [-1.9, -1.8, 2.0, '#bfdbfe'],
    [0.9, 0.6, 1.2, '#c4b5fd'],
  ] as const) {
    g.add(box(0.55, h, 0.55, mat(c, { roughness: 0.25, metalness: 0.3 }), x, 0, z));
  }
  g.add(water(6.4, 1.1, 0, 2.6, '#22d3ee'));
  g.add(place(boat('#92400e', '#fef3c7'), 1.2, 0.06, 2.6, 0.2, 1.3));
  for (const [x, z] of [
    [-2.8, 1.2],
    [2.9, 1.0],
    [-3.1, -0.4],
  ]) {
    g.add(place(palm(1.4, 0.2), x, 0, z, x));
  }
  for (const [x, z, s] of [
    [3.0, -2.2, 1.0],
    [-3.0, -2.6, 0.8],
  ]) {
    const d = sphere(s, '#efc98a', x, 0, z, 1);
    d.scale.y = 0.35;
    g.add(d);
  }
  return g;
}

// ---------- Nordics ----------

function norway(): THREE.Group {
  const wood = '#4a2c1d';
  const shingle = '#2b1a12';
  const g = new THREE.Group();
  // Stave church: stacked steep roofs.
  const cx = 0.6;
  const cz = 0.4;
  g.add(box(1.6, 0.9, 1.6, wood, cx, 0, cz));
  const roofs: Array<[number, number, number]> = [
    [1.25, 0.9, 0.55],
    [0.95, 1.6, 0.5],
    [0.7, 2.2, 0.5],
    [0.45, 2.8, 0.7],
  ];
  for (const [r, y0, h] of roofs) {
    const roof = mesh(new THREE.ConeGeometry(r, h, 4), mat(shingle), cx, y0 + h / 2, cz);
    roof.rotation.y = Math.PI / 4;
    g.add(roof, box(r * 0.95, 0.25, r * 0.95, wood, cx, y0 + h * 0.75, cz));
  }
  g.add(cone(0.18, 0.8, 4, shingle, cx, 3.45, cz));
  for (const [dx, dz, ry] of [
    [0.55, 0, 0],
    [-0.55, 0, Math.PI],
  ]) {
    const head = box(0.35, 0.08, 0.08, '#78350f', cx + dx, 2.65, cz + dz);
    head.rotation.set(0, ry, 0.5);
    g.add(head);
  }
  // A fjord between steep mountains.
  g.add(water(1.1, 9, -2.2, 0, '#0ea5e9'));
  for (const [x, z, r, h] of [
    [-3.6, -1.8, 1.3, 3.2],
    [-3.5, 1.4, 1.1, 2.6],
    [-1.0, -3.1, 1.2, 3.0],
    [2.6, -2.6, 1.2, 2.8],
  ]) {
    g.add(cone(r, h, 6, '#5b6b5a', x, 0, z), cone(r * 0.38, h * 0.38, 6, '#f8fafc', x, h * 0.62, z));
  }
  for (const [x, z] of [
    [2.9, 1.0],
    [2.2, 2.4],
    [3.3, -0.4],
    [-0.6, 2.8],
  ]) {
    g.add(place(pine(1.2), x, 0, z));
  }
  g.add(place(house(0.6, 0.45, 0.5, '#b91c1c', '#3f3f46'), 1.3, 0, 2.6, 0.3), place(house(0.55, 0.42, 0.5, '#f8fafc', '#3f3f46'), -0.4, 0, 1.8, -0.3));
  return g;
}

function sweden(): THREE.Group {
  const red = '#dc2626';
  const g = new THREE.Group();
  // A giant Dala horse on a plinth.
  const horse = group(
    box(1.5, 0.75, 0.5, red, 0, 1.0, 0),
    box(0.4, 1.0, 0.5, red, -0.55, 0, 0),
    box(0.4, 1.0, 0.5, red, 0.55, 0, 0),
    box(0.5, 1.0, 0.5, red, 0.65, 1.5, 0),
    box(0.7, 0.4, 0.5, red, 0.95, 2.25, 0),
    box(0.25, 0.4, 0.52, '#1e293b', 0.4, 1.55, 0),
  );
  for (const [x, y, c] of [
    [-0.3, 1.45, '#22c55e'],
    [0.0, 1.45, '#facc15'],
    [0.3, 1.45, '#3b82f6'],
    [-0.15, 1.2, '#ffffff'],
    [0.15, 1.2, '#ffffff'],
  ] as const) {
    horse.add(box(0.2, 0.12, 0.54, c, x, y, 0));
  }
  g.add(box(2.0, 0.4, 0.9, '#a8a29e', 0, 0, -0.6), place(horse, 0, 0.4, -0.6, 0.3, 1.1));
  // Falu-red cottages with white trim, birches and a lake.
  for (const [x, z, ry] of [
    [-2.4, 0.9, 0.4],
    [-2.6, -1.4, -0.3],
    [2.6, -1.5, 0.2],
  ]) {
    const h = house(1.0, 0.7, 0.8, '#a4161a', '#3f3f46');
    h.add(box(0.06, 0.7, 0.06, '#ffffff', -0.5, 0, 0.4), box(0.06, 0.7, 0.06, '#ffffff', 0.5, 0, 0.4));
    g.add(place(h, x, 0, z, ry));
  }
  const lake = mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.06, 20), mat('#38bdf8', { roughness: 0.1 }), 1.6, 0.03, 1.9);
  g.add(lake);
  for (const [x, z] of [
    [3.4, 0.4],
    [0.2, 3.1],
    [-1.2, 2.6],
    [3.1, 2.8],
    [-3.4, -0.3],
  ]) {
    g.add(place(birch(1.1), x, 0, z));
  }
  return g;
}

function denmark(): THREE.Group {
  const g = new THREE.Group();
  // Nyhavn's colourful row of gabled townhouses along the canal.
  const colours = ['#facc15', '#ef4444', '#3b82f6', '#fb923c', '#22c55e', '#f472b6'];
  colours.forEach((c, i) => {
    const x = -2.6 + i * 0.95;
    const h = 1.5 + (i % 3) * 0.3;
    g.add(box(0.9, h, 0.9, c, x, 0, -1.4), gable(0.9, 0.5, 0.92, '#7f1d1d', x, h, -1.4));
    for (const y of [0.35, 0.85, h - 0.3]) g.add(box(0.5, 0.18, 0.02, '#f8fafc', x, y, -0.94));
  });
  g.add(water(7, 1.1, 0, 0.0, '#0ea5e9'));
  g.add(place(boat('#1d4ed8', '#f8fafc'), -1.2, 0.06, 0.0, 0.1), place(boat('#b91c1c'), 1.4, 0.06, 0.1, -0.2));
  // The Little Mermaid on her rock.
  const bronze = '#4d7c6f';
  g.add(place(rock(0.45, '#78716c'), 2.6, 0, 1.6), cyl(0.09, 0.14, 0.45, 8, bronze, 2.6, 0.3, 1.6), sphere(0.1, bronze, 2.6, 0.85, 1.6, 1));
  const tail = mesh(new THREE.ConeGeometry(0.1, 0.5, 8), mat(bronze), 2.85, 0.35, 1.6);
  tail.rotation.z = Math.PI / 2;
  g.add(tail);
  // A windmill.
  g.add(cone(0.5, 1.8, 8, '#f8fafc', -2.8, 0, 2.0), cone(0.35, 0.3, 8, '#7f1d1d', -2.8, 1.75, 2.0));
  for (let i = 0; i < 4; i++) {
    const blade = box(0.12, 1.2, 0.03, '#a16207', 0, 0, 0);
    const hub = group(blade);
    hub.rotation.z = (i * Math.PI) / 2 + 0.3;
    hub.position.set(-2.8, 1.6, 2.5);
    g.add(hub);
  }
  g.add(place(roundTree('#22c55e', '#7c4a1e', 0.9), 3.4, 0, -0.4), place(roundTree('#22c55e', '#7c4a1e', 0.9), -0.4, 0, 2.8));
  return g;
}

function iceland(): THREE.Group {
  const concrete = '#d6d3d1';
  const g = new THREE.Group();
  // Hallgrímskirkja: a stepped central tower with stepped wings like basalt columns.
  g.add(box(0.9, 4.6, 0.8, concrete, 0, 0, -0.8), cone(0.5, 0.9, 4, '#a8a29e', 0, 4.6, -0.8), box(0.04, 0.4, 0.04, '#57534e', 0, 5.5, -0.8));
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      g.add(box(0.28, 3.6 - i * 0.62, 0.7, concrete, side * (0.6 + i * 0.28), 0, -0.8));
    }
  }
  g.add(box(1.1, 1.6, 2.2, concrete, 0, 0, -2.2), gable(1.1, 1.0, 2.2, '#a8a29e', 0, 1.6, -2.2));
  // Geysir erupting.
  const pool = mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 18), mat('#7dd3fc', { roughness: 0.1 }), 2.4, 0.03, 1.4);
  const jet = mesh(
    new THREE.CylinderGeometry(0.12, 0.3, 3.2, 10),
    mat('#e0f2fe', { transparent: true, opacity: 0.8, emissive: '#bae6fd', emissiveIntensity: 0.4 }),
    2.4,
    1.6,
    1.4,
  );
  g.add(pool, jet, sphere(0.45, mat('#f8fafc', { transparent: true, opacity: 0.85 }), 2.4, 3.3, 1.4, 1));
  // Basalt columns and a smouldering volcano.
  for (let i = 0; i < 9; i++) {
    const h = 0.4 + ((i * 37) % 7) * 0.12;
    g.add(cyl(0.18, 0.18, h, 6, '#374151', -2.6 + (i % 3) * 0.32, 0, 1.6 + Math.floor(i / 3) * 0.3));
  }
  g.add(cone(1.4, 2.0, 9, '#3f3f46', 2.8, 0, -2.2), cone(0.45, 0.25, 9, mat('#f97316', { emissive: '#ef4444', emissiveIntensity: 1.2 }), 2.8, 1.85, -2.2));
  return g;
}

// ---------- Oceania ----------

function australia(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(3.4, 0.4, 2.0, '#e7c9a0', -0.4, 0, -0.6));
  // Opera House sails: half-domes tilted like shells, in two rows.
  const shell = (x: number, z: number, s: number, ry: number) => {
    const m = mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI, 0, Math.PI / 2), mat('#f8fafc', { roughness: 0.35 }));
    m.scale.set(0.55 * s, 1.5 * s, 0.9 * s);
    m.position.set(x, 0.4, z);
    m.rotation.set(0, ry, -0.35);
    return m;
  };
  [
    [-1.6, -0.9, 0.7],
    [-0.9, -0.9, 0.95],
    [-0.1, -0.9, 1.15],
    [-1.4, -0.1, 0.55],
    [-0.8, -0.1, 0.75],
    [-0.15, -0.1, 0.9],
  ].forEach(([x, z, s]) => g.add(shell(x, z, s, Math.PI / 2)));
  // Harbour Bridge arch over the water.
  const steel = '#64748b';
  g.add(water(9, 1.2, 0, 1.6, '#0ea5e9'));
  const arch = mesh(new THREE.TorusGeometry(2.3, 0.09, 6, 24, Math.PI), mat(steel), 1.0, 0, 1.6);
  arch.rotation.y = Math.PI / 2;
  g.add(arch, box(0.5, 0.12, 5.2, steel, 1.0, 0.7, 1.6));
  for (const z of [-0.9, 4.1]) g.add(box(0.6, 1.4, 0.6, '#a8a29e', 1.0, 0, z));
  for (const [x, z] of [
    [3.2, -1.6],
    [-3.2, 0.6],
    [2.9, -0.2],
  ]) {
    g.add(place(roundTree('#84cc16', '#e7e5e4', 1.0), x, 0, z));
  }
  return g;
}

function newZealand(): THREE.Group {
  const g = new THREE.Group();
  for (const [x, z, r, h] of [
    [-2.4, -2.4, 1.4, 3.2],
    [-0.6, -3.0, 1.2, 2.6],
    [1.4, -2.7, 1.3, 3.0],
  ]) {
    g.add(cone(r, h, 7, '#64748b', x, 0, z), cone(r * 0.42, h * 0.42, 7, '#f8fafc', x, h * 0.58, z));
  }
  // Sky Tower.
  const tx = 2.4;
  const tz = 0.2;
  g.add(cyl(0.12, 0.2, 3.4, 10, '#e5e7eb', tx, 0, tz), cyl(0.55, 0.45, 0.35, 16, '#cbd5e1', tx, 3.2, tz), cyl(0.4, 0.4, 0.2, 16, '#94a3b8', tx, 3.55, tz));
  g.add(cyl(0.04, 0.08, 1.4, 6, '#f8fafc', tx, 3.75, tz));
  // Wharenui (meeting house) with red bargeboards.
  const red = '#991b1b';
  const wx = -1.4;
  const wz = 0.9;
  g.add(box(1.4, 0.8, 1.6, '#7c2d12', wx, 0, wz), gable(1.6, 0.7, 1.7, '#57534e', wx, 0.8, wz));
  for (const side of [-1, 1]) {
    const b = box(0.12, 1.05, 0.08, red, wx + side * 0.42, 0.8, wz + 0.88);
    b.rotation.z = side * -0.85;
    g.add(b);
  }
  g.add(box(0.12, 0.8, 0.08, red, wx - 0.68, 0, wz + 0.82), box(0.12, 0.8, 0.08, red, wx + 0.68, 0, wz + 0.82), box(0.4, 0.55, 0.03, '#1c1917', wx, 0, wz + 0.81));
  // Rolling hills and sheep.
  for (const [x, z, s] of [
    [0.4, 2.6, 1.2],
    [-3.0, 2.2, 1.0],
  ]) {
    const hill = sphere(s, '#4ade80', x, 0, z, 1);
    hill.scale.y = 0.35;
    g.add(hill);
  }
  for (const [x, z, r] of [
    [0.9, 1.5, 0.3],
    [1.4, 2.2, -0.6],
    [-0.2, 1.9, 1.2],
    [0.2, 3.3, 2.0],
  ]) {
    g.add(place(sheep(), x, 0.05, z, r));
  }
  g.add(place(pine(1.1, '#166534'), 3.4, 0, 2.0), place(pine(1.0, '#166534'), -3.4, 0, -0.4));
  return g;
}

export const WORLD_BUILDERS = {
  morocco,
  nigeria,
  ethiopia,
  kenya,
  'south-africa': southAfrica,
  turkey,
  jordan,
  iran,
  uae,
  norway,
  sweden,
  denmark,
  iceland,
  australia,
  'new-zealand': newZealand,
} as const;
