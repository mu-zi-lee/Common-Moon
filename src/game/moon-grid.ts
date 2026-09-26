import { Hexasphere, type Tile } from "hexasphere";

export type MoonCell = {
  tile: Tile;
  taskIndex: number;
};

const divisions = 6;
const hexasphere = new Hexasphere(2, divisions, 0.975);

function direction(point: { x: number; y: number; z: number }) {
  const length = Math.hypot(point.x, point.y, point.z);
  return { x: point.x / length, y: point.y / length, z: point.z / length };
}

function seeds(count: number) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const points = Array.from({ length: count }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / count;
    const radius = Math.sqrt(1 - y * y);
    const angle = i * goldenAngle + Math.PI / 2;
    return { x: radius * Math.cos(angle), y, z: radius * Math.sin(angle) };
  });
  const equatorial = points.reduce((closest, point) =>
    Math.abs(point.y) < Math.abs(closest.y) ? point : closest,
  );
  // The Moon rests at -0.45 radians in the scene; put the first task near its visible center.
  const angle = 0.45 - Math.atan2(equatorial.x, equatorial.z);
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  return points
    .map(({ x, y, z }) => ({ x: x * cos + z * sin, y, z: z * cos - x * sin }))
    .sort(
      (a, b) =>
        b.x * Math.sin(0.45) + b.z * Math.cos(0.45) - a.x * Math.sin(0.45) - a.z * Math.cos(0.45),
    );
}

export function moonCells(taskCount: number): MoonCell[] {
  if (!Number.isInteger(taskCount) || taskCount < 1 || taskCount > 24) return [];
  const centers = seeds(taskCount);
  return hexasphere.tiles.map((tile) => {
    const p = direction(tile.centerPoint);
    let taskIndex = 0;
    let nearest = -Infinity;
    centers.forEach((center, index) => {
      const score = p.x * center.x + p.y * center.y + p.z * center.z;
      if (score > nearest) {
        nearest = score;
        taskIndex = index;
      }
    });
    return { tile, taskIndex };
  });
}
