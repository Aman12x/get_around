import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { COUNTRIES, COUNTRY_BY_ID, type CountryId } from '../data/countries';
import type { Route } from '../data/routes';
import { stopStatus, type Journey, type StopStatus } from '../game/progress';
import { easeInOutCubic, flightArc, latLonToVec3 } from './geo';
import { createWorldTexture, type Highlight } from './worldTexture';

const R = 1;

const LOCKED_GREY = '#94a3b8';
const GOLD = '#fde047';

interface Marker {
  id: CountryId;
  group: THREE.Group;
  head: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  label: HTMLButtonElement;
  normal: THREE.Vector3;
  status: StopStatus;
}

const dashVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const dashFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uDashes;
  uniform float uProgress;
  uniform float uSolid;
  varying vec2 vUv;
  void main() {
    if (vUv.x > uProgress) discard;
    float d = fract(vUv.x * uDashes - uTime * 0.6);
    float dash = smoothstep(0.0, 0.08, d) * (1.0 - smoothstep(0.42, 0.5, d));
    float a = mix(dash, 1.0, uSolid);
    if (a < 0.02) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

function makeArcMaterial(color: string, solid: boolean, dashes: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: dashVertex,
    fragmentShader: dashFragment,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uDashes: { value: dashes },
      uProgress: { value: 1 },
      uSolid: { value: solid ? 1 : 0 },
    },
  });
}

function buildPlane(): THREE.Group {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.4 });
  const accent = new THREE.MeshStandardMaterial({ color: '#ff4d6d', flatShading: true, roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: '#38bdf8', flatShading: true, roughness: 0.2 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.9, 8), white);
  body.rotation.x = Math.PI / 2;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.25, 8), white);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 0.57;
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  cockpit.position.set(0, 0.06, 0.38);
  const wings = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.03, 0.26), accent);
  wings.position.z = 0.05;
  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.025, 0.14), accent);
  tailWing.position.z = -0.4;
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.22, 0.18), accent);
  fin.position.set(0, 0.12, -0.38);
  for (const side of [-1, 1]) {
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 8), white);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(side * 0.3, -0.05, 0.1);
    g.add(engine);
  }
  g.add(body, nose, cockpit, wings, tailWing, fin);
  g.scale.setScalar(0.09);
  return g;
}

function buildClouds(): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {
    const x = rand() * canvas.width;
    const y = canvas.height * (0.12 + rand() * 0.76);
    const r = 18 + rand() * 60;
    for (const dx of [0, -canvas.width, canvas.width]) {
      const grad = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, r);
      grad.addColorStop(0, 'rgba(255,255,255,0.55)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(x + dx, y, r * 1.8, r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.018, 64, 48),
    new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.8 }),
  );
}

function buildAtmosphere(): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.16, 64, 48),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vNormal;
        void main() {
          float i = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
          gl_FragColor = vec4(0.45, 0.75, 1.0, 1.0) * i * 1.6;
        }`,
    }),
  );
}

function buildStars(): THREE.Points {
  const n = 2500;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const palette = [new THREE.Color('#ffffff'), new THREE.Color('#fbcfe8'), new THREE.Color('#bae6fd'), new THREE.Color('#fef08a')];
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 40);
    pos.set([v.x, v.y, v.z], i * 3);
    const c = palette[i % palette.length];
    col.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({ size: 0.18, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true }),
  );
}

export class GlobeView {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 0.01, 200);
  readonly controls: OrbitControls;
  onSelect: (id: CountryId) => void = () => {};

  private earth: THREE.Mesh;
  private clouds: THREE.Mesh;
  private world = createWorldTexture(new Map());
  private markers = new Map<CountryId, Marker>();
  private arcs = new THREE.Group();
  private arcMaterials: THREE.ShaderMaterial[] = [];
  private plane = buildPlane();
  private flying = false;
  private camTween: { from: THREE.Vector3; to: THREE.Vector3; start: number; dur: number; resolve: () => void } | null = null;
  private offsetX = 0;
  private visible = true;
  private tmp = new THREE.Vector3();

  constructor(
    private dom: HTMLElement,
    private labelLayer: HTMLElement,
  ) {
    this.camera.position.set(0, 0.6, 3.4);
    this.controls = new OrbitControls(this.camera, dom);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.5;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 6;
    this.controls.autoRotateSpeed = 0.6;

    this.earth = new THREE.Mesh(
      new THREE.SphereGeometry(R, 128, 96),
      new THREE.MeshStandardMaterial({ map: this.world.texture, roughness: 0.85, metalness: 0.0 }),
    );
    this.clouds = buildClouds();

    // The key light rides with the camera so whichever face you look at is sunny.
    const sun = new THREE.DirectionalLight('#fff4e0', 2.0);
    sun.position.set(-1.5, 1.5, 1);
    this.camera.add(sun);
    const fill = new THREE.HemisphereLight('#e0e7ff', '#7c3aed', 1.2);

    this.plane.visible = false;
    this.scene.add(this.camera, this.earth, this.clouds, buildAtmosphere(), buildStars(), fill, this.arcs, this.plane);

    for (const c of COUNTRIES) this.markers.set(c.id, this.buildMarker(c.id));
  }

  private buildMarker(id: CountryId): Marker {
    const c = COUNTRY_BY_ID[id];
    const normal = latLonToVec3(c.lat, c.lon, 1);
    const group = new THREE.Group();
    group.position.copy(normal).multiplyScalar(R);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0035, 0.0035, 0.06, 6),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    );
    stem.position.y = 0.03;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 16, 12),
      new THREE.MeshStandardMaterial({ color: c.color, emissive: c.color, emissiveIntensity: 0.35, roughness: 0.3 }),
    );
    head.position.y = 0.065;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.02, 0.028, 32),
      new THREE.MeshBasicMaterial({ color: c.color, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.002;
    group.add(stem, head, ring);
    this.scene.add(group);

    const label = document.createElement('button');
    label.className = 'globe-label';
    label.innerHTML = `<span class="flag">${c.flag}</span><span class="name">${c.name}</span><span class="badge"></span>`;
    label.addEventListener('click', () => this.onSelect(id));
    this.labelLayer.appendChild(label);

    return { id, group, head, ring, label, normal, status: 'locked' };
  }

  /** Show a route's stops, statuses and flight lines. */
  setJourney(route: Route | null, journey: Journey | null): void {
    const highlights = new Map<string, Highlight>();
    const onRoute = new Set<CountryId>(route?.stops ?? COUNTRIES.map((c) => c.id));
    for (const c of COUNTRIES) {
      highlights.set(c.iso, { color: c.color, strong: !!route && onRoute.has(c.id) });
    }
    this.world.repaint(highlights);

    for (const m of this.markers.values()) {
      const show = onRoute.has(m.id);
      m.group.visible = show;
      m.label.hidden = !show;
      const status: StopStatus = route && journey ? stopStatus(journey, route, m.id) : 'next';
      m.status = status;
      const c = COUNTRY_BY_ID[m.id];
      const col = status === 'locked' ? LOCKED_GREY : status === 'cleared' ? GOLD : c.color;
      m.head.material.color.set(col);
      m.head.material.emissive.set(col);
      m.ring.material.color.set(status === 'cleared' ? GOLD : c.color);
      m.ring.visible = status === 'next' || status === 'current';
      m.group.scale.setScalar(status === 'locked' ? 0.75 : 1);
      m.label.dataset.status = status;
      m.label.disabled = !route || !journey ? false : status === 'locked';
      const badge = m.label.querySelector('.badge')!;
      badge.textContent = { locked: '🔒', next: '✈️', current: '📍', cleared: '⭐' }[status];
    }

    this.rebuildArcs(route, journey);
  }

  private rebuildArcs(route: Route | null, journey: Journey | null): void {
    for (const child of [...this.arcs.children]) {
      const mesh = child as THREE.Mesh;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this.arcs.remove(mesh);
    }
    this.arcMaterials = [];
    if (!route || !journey) return;

    const legs: Array<[CountryId, CountryId, boolean]> = [];
    for (let i = 1; i < journey.path.length; i++) legs.push([journey.path[i - 1], journey.path[i], true]);
    if (!route.openWorld) {
      for (let i = Math.max(1, journey.path.length); i < route.stops.length; i++) {
        legs.push([route.stops[i - 1], route.stops[i], false]);
      }
    }
    for (const [a, b, flown] of legs) {
      this.arcs.add(this.makeArc(a, b, flown ? GOLD : '#ffffff', flown));
    }
  }

  private makeArc(a: CountryId, b: CountryId, color: string, solid: boolean): THREE.Mesh {
    const ca = COUNTRY_BY_ID[a];
    const cb = COUNTRY_BY_ID[b];
    const pts = flightArc(latLonToVec3(ca.lat, ca.lon), latLonToVec3(cb.lat, cb.lon), R * 1.005);
    const curve = new THREE.CatmullRomCurve3(pts);
    const len = curve.getLength();
    const mat = makeArcMaterial(color, solid, Math.max(4, Math.round(len * 18)));
    this.arcMaterials.push(mat);
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 128, solid ? 0.0045 : 0.003, 6, false), mat);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.labelLayer.hidden = !v;
    this.controls.enabled = v && !this.flying;
  }

  setIdle(idle: boolean): void {
    this.controls.autoRotate = idle;
  }

  /** Swing the camera to look down on a country. */
  focusOn(id: CountryId, distance = 2.6, duration = 1.4): Promise<void> {
    const c = COUNTRY_BY_ID[id];
    const to = latLonToVec3(c.lat - 12, c.lon, distance * this.portraitZoom());
    return this.tweenCamera(to, duration);
  }

  private tweenCamera(to: THREE.Vector3, dur: number): Promise<void> {
    this.camTween?.resolve();
    return new Promise((resolve) => {
      this.camTween = { from: this.camera.position.clone(), to, start: performance.now(), dur, resolve };
    });
  }

  /** Animate the plane along a great-circle arc from one country to another. */
  async fly(from: CountryId | null, to: CountryId): Promise<void> {
    if (!from || from === to) {
      await this.focusOn(to, 2.2, 1.6);
      return;
    }
    const ca = COUNTRY_BY_ID[from];
    const cb = COUNTRY_BY_ID[to];
    const a = latLonToVec3(ca.lat, ca.lon);
    const b = latLonToVec3(cb.lat, cb.lon);
    await this.focusOn(from, 2.6, 0.9);

    const pts = flightArc(a, b, R * 1.005, 200);
    const curve = new THREE.CatmullRomCurve3(pts);
    const trail = this.makeArc(from, to, GOLD, true);
    const trailMat = trail.material as THREE.ShaderMaterial;
    trailMat.uniforms.uProgress.value = 0;
    this.arcs.add(trail);

    this.flying = true;
    this.controls.enabled = false;
    this.controls.autoRotate = false;
    this.plane.visible = true;
    const dur = 2.4 + 2.6 * (a.angleTo(b) / Math.PI);

    await new Promise<void>((resolve) => {
      const start = performance.now();
      const step = () => {
        const raw = Math.min(1, (performance.now() - start) / (dur * 1000));
        const t = easeInOutCubic(raw);
        const p = curve.getPointAt(t);
        const ahead = curve.getPointAt(Math.min(1, t + 0.01));
        const up = p.clone().normalize();
        this.plane.position.copy(p).addScaledVector(up, 0.02);
        this.plane.up.copy(up);
        if (t < 0.999) this.plane.lookAt(ahead.clone().addScaledVector(up, 0.02));
        trailMat.uniforms.uProgress.value = t;

        const tangent = ahead.clone().sub(p).normalize();
        // Chase-cam: hang back and above the plane, looking just ahead of it.
        const camTarget = up.clone().multiplyScalar(0.95).addScaledVector(tangent, -0.55).normalize().multiplyScalar(2.0 * this.portraitZoom());
        this.camera.position.lerp(camTarget, raw < 0.05 ? 0.05 : 0.1);
        // Ease the gaze back to the globe centre on final approach so orbit controls resume smoothly.
        const settle = THREE.MathUtils.smoothstep(raw, 0.75, 1);
        this.camera.lookAt(p.clone().multiplyScalar(0.55 * (1 - settle)));
        if (raw < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });

    this.plane.visible = false;
    this.flying = false;
    this.controls.enabled = this.visible;
    this.controls.update();
  }

  /** Pull the camera back on tall, narrow screens so the globe still fits. */
  private portraitZoom(): number {
    return this.camera.aspect < 1 ? 1.45 : 1;
  }

  /** Shift the globe sideways on screen (fraction of width) to make room for UI. */
  setFraming(offsetX: number): void {
    this.offsetX = offsetX;
    this.applyFraming();
  }

  private applyFraming(): void {
    const w = this.dom.clientWidth || window.innerWidth;
    const h = this.dom.clientHeight || window.innerHeight;
    // Only offset on wide screens; on phones the UI stacks below the globe instead.
    if (this.offsetX && w > 900) this.camera.setViewOffset(w, h, -w * this.offsetX, 0, w, h);
    else this.camera.clearViewOffset();
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.applyFraming();
    this.camera.updateProjectionMatrix();
  }

  update(dt: number, time: number): void {
    this.clouds.rotation.y += dt * 0.01;
    for (const m of this.arcMaterials) m.uniforms.uTime.value = time;

    if (this.camTween && !this.flying) {
      const tw = this.camTween;
      const p = Math.min(1, (performance.now() - tw.start) / (tw.dur * 1000));
      const k = easeInOutCubic(p);
      const dir = tw.from.clone().normalize().lerp(tw.to.clone().normalize(), k).normalize();
      const dist = THREE.MathUtils.lerp(tw.from.length(), tw.to.length(), k);
      this.camera.position.copy(dir.multiplyScalar(dist));
      this.camera.lookAt(0, 0, 0);
      if (p >= 1) {
        this.camTween = null;
        tw.resolve();
      }
    } else if (!this.flying) {
      this.controls.update();
    }

    const pulse = (time * 0.8) % 1;
    for (const m of this.markers.values()) {
      if (m.ring.visible) {
        m.ring.scale.setScalar(1 + pulse * 1.8);
        m.ring.material.opacity = 1 - pulse;
      }
      m.head.position.y = 0.065 + Math.sin(time * 2 + m.normal.x * 10) * 0.004;
    }

    if (this.visible) this.positionLabels();
  }

  private positionLabels(): void {
    const w = this.dom.clientWidth;
    const h = this.dom.clientHeight;
    const camDir = this.camera.position.clone().normalize();
    for (const m of this.markers.values()) {
      if (!m.group.visible) continue;
      const facing = m.normal.dot(camDir);
      if (facing < 0.2 || this.flying) {
        m.label.style.opacity = '0';
        m.label.style.pointerEvents = 'none';
        continue;
      }
      this.tmp.copy(m.normal).multiplyScalar(R + 0.09).project(this.camera);
      const x = (this.tmp.x * 0.5 + 0.5) * w;
      const y = (-this.tmp.y * 0.5 + 0.5) * h;
      m.label.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;
      m.label.style.opacity = String(Math.min(1, (facing - 0.2) * 4));
      m.label.style.pointerEvents = 'auto';
      m.label.style.zIndex = String(Math.round(facing * 100));
    }
  }
}
