import * as THREE from 'three';

/** Lat/lon (degrees) → point on a sphere, matching three.js SphereGeometry's equirectangular UVs. */
export function latLonToVec3(lat: number, lon: number, radius = 1): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/** Great-circle arc between two surface points, lifted off the surface like a flight path. */
export function flightArc(a: THREE.Vector3, b: THREE.Vector3, radius: number, segments = 96): THREE.Vector3[] {
  const ua = a.clone().normalize();
  const ub = b.clone().normalize();
  const angle = ua.angleTo(ub);
  const lift = 0.06 + 0.32 * (angle / Math.PI);
  const qa = new THREE.Quaternion();
  const qFull = new THREE.Quaternion().setFromUnitVectors(ua, ub);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const q = qa.clone().slerp(qFull, t);
    const r = radius * (1 + lift * Math.sin(Math.PI * t));
    pts.push(ua.clone().applyQuaternion(q).multiplyScalar(r));
  }
  return pts;
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
