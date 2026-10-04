import * as THREE from 'three';
import { COUNTRY_BY_ID, type CountryId } from '../data/countries';
import { buildLandmark } from './landmarks';

/**
 * Renders a country's landmark on a mini island into a still image, for the
 * "spot the landmark" round. Uses its own small offscreen renderer and caches results.
 */
const SIZE = 320;
const cache = new Map<CountryId, string>();
let renderer: THREE.WebGLRenderer | null = null;

function getRenderer(): THREE.WebGLRenderer {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
  }
  return renderer;
}

export function landmarkThumb(id: CountryId): string {
  const hit = cache.get(id);
  if (hit) return hit;

  const scene = new THREE.Scene();
  const root = new THREE.Group();
  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 4.4, 0.6, 20),
    new THREE.MeshStandardMaterial({ color: COUNTRY_BY_ID[id].ground, flatShading: true, roughness: 0.9 }),
  );
  island.position.y = -0.3;
  root.add(island, buildLandmark(id));
  scene.add(root, new THREE.HemisphereLight('#ffffff', '#8b7cc8', 1.6));
  const sun = new THREE.DirectionalLight('#fff3d6', 2.4);
  sun.position.set(5, 10, 7);
  scene.add(sun);

  // Frame the landmark: look slightly down from the front-right, fitting its bounding sphere.
  const sphere = new THREE.Box3().setFromObject(root).getBoundingSphere(new THREE.Sphere());
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
  const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(35 / 2)) * 0.92;
  camera.position.copy(sphere.center).add(new THREE.Vector3(0.55, 0.45, 1).normalize().multiplyScalar(dist));
  camera.lookAt(sphere.center);

  const r = getRenderer();
  r.setClearColor(0x000000, 0);
  r.render(scene, camera);
  const url = r.domElement.toDataURL('image/png');
  cache.set(id, url);

  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.geometry.dispose();
  });
  (island.material as THREE.Material).dispose();
  return url;
}
