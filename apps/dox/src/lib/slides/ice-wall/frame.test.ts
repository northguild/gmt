import { describe, expect, it } from "vitest";
import { buildFrame, paneLayout, projectWall, type PaneModel } from "./frame";
import { cells } from "./voronoi";

const lens = { cx: 480, cy: 270, focalPx: 1200 };

const model = (id: number): PaneModel => ({
  id: String(id),
  seed: id + 1,
  cells: cells(id + 1, 24),
  rect: paneLayout(6, 960)[id]!,
  pins: [],
});

const input = (times: (number | null)[], z = 1) => ({
  lens,
  z,
  panes: [0, 1, 2, 3, 4, 5].map(model),
  times,
  impacts: [0, 1, 2, 3, 4, 5].map(() => [0.5, 0.5] as [number, number]),
  reduced: false,
  target: () => null,
});

describe("paneLayout", () => {
  const width = 960;
  const cy = 300;
  const rects = paneLayout(6, width, cy, 480);
  /* Where a pane lands on the stage, from the stage's top left. */
  const left = (r: (typeof rects)[number]) => r.x + 480;
  const top = (r: (typeof rects)[number]) => r.y + cy;

  it("hangs three panes down each side edge, clear of the centre", () => {
    expect(rects).toHaveLength(6);
    for (const r of rects.slice(0, 3)) expect(left(r)).toBe(rects[0]!.x + 480);
    for (const r of rects.slice(3)) expect(left(r)).toBe(left(rects[3]!));
    expect(left(rects[0]!)).toBeGreaterThan(0);
    expect(left(rects[3]!) + rects[3]!.w).toBeLessThan(width);
    const leftEdge = left(rects[0]!) + rects[0]!.w;
    const rightEdge = left(rects[3]!);
    expect(rightEdge - leftEdge).toBeGreaterThan(width * 0.55);
  });

  it("stacks each column top to bottom without touching, the columns level", () => {
    for (const [a, b] of [
      [0, 1],
      [1, 2],
      [3, 4],
      [4, 5],
    ] as const)
      expect(rects[a]!.y + rects[a]!.h).toBeLessThan(rects[b]!.y);
    for (let i = 0; i < 3; i += 1)
      expect(rects[i]!.y).toBeCloseTo(rects[i + 3]!.y, 9);
  });

  it("keeps the columns under the title and inside the stage, each pane wide enough to read", () => {
    expect(top(rects[0]!)).toBeGreaterThanOrEqual(width * 0.12 - 1e-9);
    expect(top(rects[2]!) + rects[2]!.h).toBeLessThan((width * 9) / 16);
    expect(rects[0]!.w).toBeGreaterThanOrEqual(width * 0.16 - 1e-9);
  });

  it("follows the lens centre, so a pane stays where the stage puts it", () => {
    const moved = paneLayout(6, width, cy + 40, 500);
    expect(moved[0]!.y + cy + 40).toBeCloseTo(top(rects[0]!), 9);
    expect(moved[0]!.x + 500).toBeCloseTo(left(rects[0]!), 9);
  });

  it("splits an uneven count with the left column the longer", () => {
    const five = paneLayout(5, width, cy, 480);
    expect(five.filter((r) => r.x < 0)).toHaveLength(3);
  });
});

describe("projectWall", () => {
  it("puts the wall's centre on the lens centre at any depth", () => {
    expect(projectWall(lens, 1, 0, 0)).toEqual([480, 270]);
    expect(projectWall(lens, 0.5, 0, 0)).toEqual([480, 270]);
  });

  it("makes a nearer wall bigger", () => {
    const far = projectWall(lens, 1, 100, 0)![0];
    const near = projectWall(lens, 0.5, 100, 0)![0];
    expect(near - 480).toBeCloseTo((far - 480) * 2, 9);
  });

  it("does not draw behind the camera", () => {
    expect(projectWall(lens, 0, 100, 0)).toBeNull();
  });
});

describe("buildFrame", () => {
  it("is a quad per pane for a whole wall", () => {
    const out = buildFrame(input([null, null, null, null, null, null]));
    expect(out.drawables).toHaveLength(6);
    expect(out.moving).toBe(false);
  });

  it("is a shard per cell once broken, and keeps moving", () => {
    const out = buildFrame(input([100, 100, 100, 100, 100, 100]));
    expect(out.drawables.length).toBeGreaterThan(80);
    expect(out.moving).toBe(true);
  });

  it("is empty and still when the shards have faded", () => {
    const out = buildFrame(input([2000, 2000, 2000, 2000, 2000, 2000]));
    expect(out.drawables).toHaveLength(0);
    expect(out.moving).toBe(false);
  });
});
