import { expect, it } from "vitest";
import * as THREE from "three";
import { spherePoint } from "./moon-path";

it("keeps supply travel on the lunar surface even for opposite sites", () => {
  const a = new THREE.Vector3(1, 0, 0);
  const b = new THREE.Vector3(-1, 0, 0);
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const point = spherePoint(a, b, t);
    expect(point.length()).toBeCloseTo(1);
    expect(Number.isFinite(point.x + point.y + point.z)).toBe(true);
  }
  expect(spherePoint(a, b, 1).distanceTo(b)).toBeLessThan(1e-6);
});
