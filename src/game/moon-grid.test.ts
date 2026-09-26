import { describe, expect, it } from "vitest";
import { moonCells } from "./moon-grid";

describe("hex Moon", () => {
  for (const count of [1, 2, 6, 12, 24]) {
    it(`covers the whole sphere with ${count} connected task regions`, () => {
      const cells = moonCells(count);
      expect(cells).toHaveLength(362);
      expect(
        cells.every(({ tile }) => tile.boundary.length === 5 || tile.boundary.length === 6),
      ).toBe(true);
      const owners = new Map(cells.map(({ tile, taskIndex }) => [tile.toString(), taskIndex]));
      for (let taskIndex = 0; taskIndex < count; taskIndex++) {
        const region = cells.filter((cell) => cell.taskIndex === taskIndex);
        expect(region.length).toBeGreaterThan(0);
        const pending = [region[0].tile];
        const visited = new Set<string>();
        while (pending.length) {
          const tile = pending.pop()!;
          const key = tile.toString();
          if (visited.has(key)) continue;
          visited.add(key);
          pending.push(
            ...tile.neighbors.filter(
              (neighbor) =>
                owners.get(neighbor.toString()) === taskIndex && !visited.has(neighbor.toString()),
            ),
          );
        }
        expect(visited.size).toBe(region.length);
      }
    });
  }

  it("starts the first task on the visible face of the Moon", () => {
    const first = moonCells(6).filter((cell) => cell.taskIndex === 0);
    const facing =
      first.reduce((total, { tile }) => {
        const { x, y, z } = tile.centerPoint;
        return total + (x * Math.sin(0.45) + z * Math.cos(0.45)) / Math.hypot(x, y, z);
      }, 0) / first.length;
    expect(facing).toBeGreaterThan(0.7);
  });
});
