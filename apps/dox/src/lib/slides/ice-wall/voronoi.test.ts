import { describe, expect, it } from "vitest";
import { cells, hashSeed, type Cell } from "./voronoi";

const SEEDS = ["momentjs", "luxon", "date-fns", "dayjs"].map(hashSeed);

/** Whether every turn along the polygon bends the same way. */
function isConvex(cell: Cell): boolean {
  const { poly } = cell;
  let sign = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const c = poly[(i + 2) % poly.length]!;
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cross) < 1e-12) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** Whether a point is inside or on a convex polygon. */
function holds(cell: Cell, p: readonly [number, number]): boolean {
  const { poly } = cell;
  return poly.every((a, i) => {
    const b = poly[(i + 1) % poly.length]!;
    return (
      (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-9
    );
  });
}

describe("ice-break cells", () => {
  it.each(SEEDS)("tile the unit rectangle (seed %i)", (seed) => {
    const all = cells(seed, 24);
    expect(all).toHaveLength(24);
    expect(all.reduce((sum, c) => sum + c.area, 0)).toBeCloseTo(1, 9);
    for (const cell of all) {
      expect(cell.area).toBeGreaterThan(0);
      for (const [x, y] of cell.poly) {
        expect(x).toBeGreaterThanOrEqual(-1e-12);
        expect(x).toBeLessThanOrEqual(1 + 1e-12);
        expect(y).toBeGreaterThanOrEqual(-1e-12);
        expect(y).toBeLessThanOrEqual(1 + 1e-12);
      }
    }
  });

  it("are convex and each holds its site", () => {
    for (const seed of SEEDS)
      for (const cell of cells(seed, 24)) {
        expect(isConvex(cell)).toBe(true);
        expect(holds(cell, cell.site)).toBe(true);
        expect(holds(cell, cell.centroid)).toBe(true);
      }
  });

  it("give the same cells for the same seed and others for another", () => {
    expect(cells(SEEDS[0]!, 24)).toEqual(cells(SEEDS[0]!, 24));
    expect(cells(SEEDS[0]!, 24)).not.toEqual(cells(SEEDS[1]!, 24));
  });

  it("are small near the middle and large at the edge", () => {
    const all = cells(SEEDS[0]!, 24);
    const dist = (c: Cell) => Math.hypot(c.site[0] - 0.5, c.site[1] - 0.5);
    const sorted = [...all].sort((a, b) => dist(a) - dist(b));
    const mean = (xs: Cell[]) => xs.reduce((s, c) => s + c.area, 0) / xs.length;
    expect(mean(sorted.slice(0, 8))).toBeLessThan(mean(sorted.slice(-8)));
  });
});
