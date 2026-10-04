import * as THREE from 'three';

/** Tiny low-poly modelling kit used by the procedural landmarks. */

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

export function mat(color: string, opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const key = color + JSON.stringify(opts);
  let m = materialCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...opts });
    materialCache.set(key, m);
  }
  return m;
}

export function mesh(geo: THREE.BufferGeometry, color: string | THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color) : color);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Box resting on y (bottom face at y). */
export function box(w: number, h: number, d: number, color: string | THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  return mesh(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z);
}

/** Cylinder/frustum resting on y. */
export function cyl(
  rTop: number,
  rBottom: number,
  h: number,
  seg: number,
  color: string | THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  return mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), color, x, y + h / 2, z);
}

/** Cone resting on y. */
export function cone(r: number, h: number, seg: number, color: string | THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  return mesh(new THREE.ConeGeometry(r, h, seg), color, x, y + h / 2, z);
}

export function sphere(r: number, color: string | THREE.Material, x = 0, y = 0, z = 0, detail = 0): THREE.Mesh {
  return mesh(new THREE.IcosahedronGeometry(r, detail), color, x, y, z);
}

/** A beam of square/round section between two points. */
export function strut(a: THREE.Vector3, b: THREE.Vector3, r: number, color: string | THREE.Material, seg = 4): THREE.Mesh {
  const dir = b.clone().sub(a);
  const m = mesh(new THREE.CylinderGeometry(r, r, dir.length(), seg), color);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

export function group(...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  if (children.length) g.add(...children);
  return g;
}

/** Move an object by (x, y, z), keeping any resting offset the builder gave it. */
export function place<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rotY = 0, scale = 1): T {
  o.position.add(new THREE.Vector3(x, y, z));
  o.rotation.y = rotY;
  o.scale.setScalar(scale);
  return o;
}

/** Deterministic PRNG so every diorama looks the same on every visit. */
export function rng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// ---------- Scenery props ----------

export function roundTree(color = '#4ade80', trunk = '#8b5a2b', h = 1): THREE.Group {
  return group(
    cyl(0.07 * h, 0.1 * h, 0.6 * h, 6, trunk),
    sphere(0.45 * h, color, 0, 0.85 * h, 0),
    sphere(0.3 * h, color, 0.22 * h, 1.05 * h, 0.1 * h),
  );
}

export function cypress(h = 1.6, color = '#166534'): THREE.Group {
  return group(cyl(0.05, 0.07, 0.25, 5, '#7c4a1e'), cone(0.22, h, 7, color, 0, 0.2, 0));
}

export function palm(h = 1.6, lean = 0.2): THREE.Group {
  const g = new THREE.Group();
  const top = new THREE.Vector3(lean, h, 0);
  g.add(strut(new THREE.Vector3(0, 0, 0), top, 0.06, '#a16207', 6));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const leaf = mesh(new THREE.ConeGeometry(0.14, 0.9, 4), '#22c55e');
    leaf.position.copy(top).add(new THREE.Vector3(Math.cos(a) * 0.35, -0.08, Math.sin(a) * 0.35));
    leaf.rotation.set(0, -a, 0);
    leaf.rotateZ(-Math.PI / 2 - 0.35);
    leaf.scale.set(1, 1, 0.35);
    g.add(leaf);
  }
  return g;
}

export function blossom(h = 1): THREE.Group {
  return group(
    cyl(0.06 * h, 0.09 * h, 0.7 * h, 6, '#6b3e26'),
    sphere(0.42 * h, '#f9a8d4', 0, 0.95 * h, 0),
    sphere(0.32 * h, '#fbcfe8', 0.3 * h, 0.85 * h, 0.15 * h),
    sphere(0.28 * h, '#f472b6', -0.25 * h, 0.9 * h, -0.1 * h),
  );
}

export function cactus(h = 1): THREE.Group {
  const c = '#16a34a';
  return group(
    cyl(0.12 * h, 0.13 * h, h, 7, c),
    cyl(0.07 * h, 0.07 * h, 0.35 * h, 6, c, 0.22 * h, 0.45 * h, 0),
    box(0.22 * h, 0.08 * h, 0.08 * h, c, 0.1 * h, 0.42 * h, 0),
    cyl(0.07 * h, 0.07 * h, 0.3 * h, 6, c, -0.2 * h, 0.3 * h, 0),
    box(0.2 * h, 0.08 * h, 0.08 * h, c, -0.1 * h, 0.28 * h, 0),
  );
}

export function rock(s = 0.3, color = '#94a3b8'): THREE.Mesh {
  const m = mesh(new THREE.DodecahedronGeometry(s, 0), color);
  m.scale.y = 0.6;
  m.position.y = s * 0.3;
  return m;
}

export function water(w: number, d: number, x = 0, z = 0, color = '#38bdf8'): THREE.Mesh {
  const m = box(w, 0.06, d, mat(color, { roughness: 0.15, metalness: 0.1 }), x, 0, z);
  m.castShadow = false;
  return m;
}

/** Triangular-prism roof: base `w` wide, `h` tall, running `d` deep along z, resting on y. */
export function gable(w: number, h: number, d: number, color: string | THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, h);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  return mesh(geo, color, x, y, z);
}

/** A simple house: walls, gabled roof and a door. */
export function house(w: number, h: number, d: number, wall: string, roof: string): THREE.Group {
  return group(
    box(w, h, d, wall, 0, 0, 0),
    gable(w * 1.08, h * 0.6, d * 1.06, roof, 0, h, 0),
    box(w * 0.22, h * 0.45, 0.03, '#3f2a1d', 0, 0, d / 2 + 0.005),
  );
}

export function acacia(h = 1): THREE.Group {
  const trunk = '#6b4423';
  const leaf = '#7a9a3a';
  const g = group(strut(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.15 * h, 1.1 * h, 0), 0.06 * h, trunk, 5));
  const canopy = mesh(new THREE.CylinderGeometry(0.75 * h, 0.55 * h, 0.22 * h, 9), mat(leaf), 0.15 * h, 1.2 * h, 0);
  g.add(canopy, mesh(new THREE.CylinderGeometry(0.45 * h, 0.4 * h, 0.16 * h, 8), mat(leaf), -0.2 * h, 1.36 * h, 0.1 * h));
  return g;
}

export function pine(h = 1, color = '#14532d'): THREE.Group {
  return group(
    cyl(0.05 * h, 0.07 * h, 0.3 * h, 5, '#5b3a29'),
    cone(0.42 * h, 0.7 * h, 7, color, 0, 0.25 * h, 0),
    cone(0.32 * h, 0.6 * h, 7, color, 0, 0.6 * h, 0),
    cone(0.2 * h, 0.5 * h, 7, color, 0, 0.92 * h, 0),
  );
}

export function birch(h = 1): THREE.Group {
  return group(
    cyl(0.05 * h, 0.07 * h, 1.1 * h, 6, '#f5f5f4'),
    box(0.11 * h, 0.04 * h, 0.11 * h, '#292524', 0, 0.35 * h, 0),
    box(0.11 * h, 0.04 * h, 0.11 * h, '#292524', 0, 0.7 * h, 0),
    sphere(0.38 * h, '#a3e635', 0, 1.2 * h, 0),
  );
}

export function balloon(color: string, stripe: string): THREE.Group {
  const env = mesh(new THREE.SphereGeometry(0.5, 12, 10), mat(color));
  env.scale.set(1, 1.15, 1);
  env.position.y = 1.0;
  const band = mesh(new THREE.CylinderGeometry(0.51, 0.51, 0.18, 12), mat(stripe), 0, 1.0, 0);
  band.scale.set(1, 1, 1);
  const skirt = mesh(new THREE.ConeGeometry(0.3, 0.4, 10), mat(color), 0, 0.45, 0);
  skirt.rotation.x = Math.PI;
  const basket = box(0.22, 0.18, 0.22, '#92400e', 0, 0, 0);
  return group(env, band, skirt, basket);
}

export function boat(hull: string, sail?: string): THREE.Group {
  const g = group(box(0.9, 0.18, 0.32, hull, 0, 0, 0), box(0.6, 0.06, 0.26, '#fef3c7', 0, 0.18, 0));
  if (sail) {
    g.add(cyl(0.02, 0.02, 0.9, 4, '#78350f', 0, 0.18, 0));
    const s = mesh(new THREE.ConeGeometry(0.32, 0.75, 3), mat(sail), 0.12, 0.62, 0);
    s.scale.set(1, 1, 0.12);
    g.add(s);
  }
  return g;
}
