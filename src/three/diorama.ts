import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { COUNTRY_BY_ID, type CountryId } from '../data/countries';
import { cyl, mat, rng, rock, sphere } from './kit';
import { buildLandmark } from './landmarks';

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
}

function skyMaterial(top: string, bottom: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTop: { value: new THREE.Color(top) }, uBottom: { value: new THREE.Color(bottom) } },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vPos = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uBottom;
      varying vec3 vPos;
      void main() {
        float h = clamp(vPos.y * 0.5 + 0.55, 0.0, 1.0);
        gl_FragColor = vec4(mix(uBottom, uTop, pow(h, 1.4)), 1.0);
      }`,
  });
}

function cloud(r: () => number): THREE.Group {
  const g = new THREE.Group();
  const white = mat('#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.55 });
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const s = sphere(0.5 + r() * 0.5, white, i * 0.6 - n * 0.3, r() * 0.3, r() * 0.4, 1);
    s.castShadow = false;
    g.add(s);
  }
  return g;
}

/** A floating island diorama showing one nation's landmark. */
export class DioramaView {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  readonly controls: OrbitControls;
  private root = new THREE.Group();
  private sky: THREE.Mesh;
  private clouds: THREE.Group[] = [];
  private sparkles!: THREE.Points;
  private particles: Particle[] = [];
  private current: CountryId | null = null;
  private introStart = 0;
  private intro = 1;

  constructor(dom: HTMLElement) {
    this.controls = new OrbitControls(this.camera, dom);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.minDistance = 9;
    this.controls.maxDistance = 22;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.minPolarAngle = Math.PI * 0.2;
    this.controls.target.set(0, 2.2, 0);
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.7;
    this.controls.enabled = false;

    this.sky = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), skyMaterial('#6d83f2', '#ffd1e8'));
    const sun = new THREE.DirectionalLight('#fff3d6', 2.6);
    sun.position.set(6, 12, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -8;
    sc.right = sc.top = 8;
    sc.near = 1;
    sc.far = 40;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    this.scene.add(this.sky, sun, new THREE.HemisphereLight('#ffffff', '#7c6aa8', 1.2), this.root);
  }

  setActive(active: boolean): void {
    this.controls.enabled = active;
  }

  show(id: CountryId): void {
    if (this.current === id) return;
    this.current = id;
    const c = COUNTRY_BY_ID[id];
    (this.sky.material as THREE.ShaderMaterial).uniforms.uTop.value.set(c.sky[0]);
    (this.sky.material as THREE.ShaderMaterial).uniforms.uBottom.value.set(c.sky[1]);
    this.scene.fog = new THREE.Fog(c.sky[1], 30, 90);

    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh || (o as THREE.Points).isPoints) m.geometry.dispose();
    });
    this.root.clear();
    this.clouds = [];
    this.particles = [];

    this.root.add(this.buildIsland(c.ground, id.length * 97 + id.charCodeAt(0)));
    this.root.add(buildLandmark(id));

    const r = rng(id.charCodeAt(1) * 131);
    for (let i = 0; i < 7; i++) {
      const cl = cloud(r);
      const a = r() * Math.PI * 2;
      const d = 9 + r() * 8;
      cl.position.set(Math.cos(a) * d, 2 + r() * 6, Math.sin(a) * d);
      cl.userData.speed = 0.04 + r() * 0.06;
      cl.userData.angle = a;
      cl.userData.dist = d;
      this.clouds.push(cl);
      this.root.add(cl);
    }

    this.sparkles = this.buildSparkles(c.color);
    this.root.add(this.sparkles);

    this.intro = 0;
    this.introStart = performance.now();
    this.camera.position.set(0, 9, 22);
    this.controls.target.set(0, 2.2, 0);
  }

  private buildIsland(ground: string, seed: number): THREE.Group {
    const r = rng(seed);
    const g = new THREE.Group();
    const top = cyl(5, 4.7, 0.5, 20, ground, 0, -0.5, 0);
    const dirt = cyl(4.7, 3.4, 1.3, 16, '#a16207', 0, -1.8, 0);
    const deep = mesh(new THREE.ConeGeometry(3.4, 3.4, 12), mat('#78350f'));
    deep.rotation.x = Math.PI;
    deep.position.y = -3.5;
    g.add(top, dirt, deep);
    // Rocks and grass tufts around the rim.
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2;
      const d = 3.9 + r() * 0.8;
      const rk = rock(0.12 + r() * 0.18, r() > 0.5 ? '#a8a29e' : '#cbd5e1');
      rk.position.x = Math.cos(a) * d;
      rk.position.z = Math.sin(a) * d;
      g.add(rk);
    }
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2;
      const d = 1 + r() * 3.6;
      const tuft = mesh(new THREE.IcosahedronGeometry(0.09 + r() * 0.07, 0), mat(new THREE.Color(ground).offsetHSL(0.02, 0.1, -0.1).getStyle()));
      tuft.scale.y = 0.6;
      tuft.position.set(Math.cos(a) * d, 0.03, Math.sin(a) * d);
      g.add(tuft);
    }
    // Little waterfall off the edge.
    const fall = mesh(
      new THREE.BoxGeometry(0.5, 4, 0.08),
      mat('#7dd3fc', { transparent: true, opacity: 0.75, emissive: '#38bdf8', emissiveIntensity: 0.3 }),
    );
    fall.position.set(Math.cos(2.2) * 4.85, -2.2, Math.sin(2.2) * 4.85);
    fall.lookAt(0, -2.2, 0);
    g.add(fall);
    return g;
  }

  private buildSparkles(color: string): THREE.Points {
    const n = 220;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 2 + Math.random() * 9;
      pos.set([Math.cos(a) * d, Math.random() * 9 - 2, Math.sin(a) * d], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        map: dotTexture(),
        color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.5),
        size: 0.16,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
  }

  /** Confetti burst from the landmark — used for correct answers and stamps. */
  celebrate(colors: string[], count = 70): void {
    // Cap live confetti so rapid answers can't pile up thousands of meshes.
    const room = Math.max(0, 400 - this.particles.length);
    for (let i = 0; i < Math.min(count, room); i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(0.16, 0.1),
        new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide, transparent: true }),
      );
      m.position.set((Math.random() - 0.5) * 1.5, 3 + Math.random(), (Math.random() - 0.5) * 1.5);
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 4;
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3(Math.cos(a) * s, 4 + Math.random() * 5, Math.sin(a) * s),
        spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
        life: 2.5 + Math.random(),
      });
      this.root.add(m);
    }
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    if (w > 760) this.camera.setViewOffset(w, h, Math.min(w * 0.2, 300), 0, w, h);
    else this.camera.setViewOffset(w, h, 0, h * 0.22, w, h);
    this.camera.updateProjectionMatrix();
    // Pull back on narrow (portrait) screens so the whole island fits.
    this.controls.minDistance = w < h ? 14 : 9;
  }

  update(dt: number, time: number): void {
    if (this.intro < 1) {
      this.intro = Math.min(1, (performance.now() - this.introStart) / 2200);
      const k = 1 - Math.pow(1 - this.intro, 3);
      const portrait = this.camera.aspect < 1;
      const endDist = portrait ? 19 : 14;
      const dist = THREE.MathUtils.lerp(26, endDist, k);
      const ang = THREE.MathUtils.lerp(-0.9, 0.35, k);
      this.camera.position.set(Math.sin(ang) * dist, THREE.MathUtils.lerp(12, 5.5, k), Math.cos(ang) * dist);
      this.camera.lookAt(this.controls.target);
    } else {
      this.controls.update(dt);
    }

    this.root.position.y = Math.sin(time * 0.8) * 0.12;
    for (const cl of this.clouds) {
      cl.userData.angle += dt * cl.userData.speed * 0.2;
      cl.position.x = Math.cos(cl.userData.angle) * cl.userData.dist;
      cl.position.z = Math.sin(cl.userData.angle) * cl.userData.dist;
    }
    if (this.sparkles) this.sparkles.rotation.y += dt * 0.05;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vel.y -= 9 * dt;
      p.vel.multiplyScalar(1 - dt * 0.8);
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.spin.x * dt;
      p.mesh.rotation.y += p.spin.y * dt;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, p.life);
      if (p.life <= 0) {
        this.root.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
  }
}

let dot: THREE.Texture | null = null;
function dotTexture(): THREE.Texture {
  if (dot) return dot;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  dot = new THREE.CanvasTexture(c);
  return dot;
}

function mesh(geo: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
