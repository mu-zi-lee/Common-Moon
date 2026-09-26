import * as THREE from "three";

export function spherePoint(start: THREE.Vector3, end: THREE.Vector3, fraction: number) {
  const a = start.clone().normalize();
  const b = end.clone().normalize();
  const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1);
  if (dot > 0.9995) return a.lerp(b, fraction).normalize();
  if (dot < -0.9995) {
    const axis = new THREE.Vector3(1, 0, 0);
    if (Math.abs(a.dot(axis)) > 0.9) axis.set(0, 1, 0);
    axis.cross(a).normalize();
    return a.applyAxisAngle(axis, Math.PI * fraction);
  }
  const angle = Math.acos(dot);
  const denominator = Math.sin(angle);
  return a
    .multiplyScalar(Math.sin((1 - fraction) * angle) / denominator)
    .addScaledVector(b, Math.sin(fraction * angle) / denominator)
    .normalize();
}
