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

  it("hangs the panes in the left two thirds, clear of the Earth's third", () => {
    expect(rects).toHaveLength(6);
    for (const r of rects) {
      expect(left(r)).toBeGreaterThanOrEqual(width * 0.06 - 1e-9);
      expect(left(r) + r.w).toBeLessThanOrEqual(width * 0.64 + 1e-9);
    }
  });

  it("lays three columns and two rows, filling each row left to right", () => {
    expect(new Set(rects.map((r) => left(r))).size).toBe(3);
    for (const i of [0, 1, 2]) {
      expect(rects[i + 3]!.x).toBeCloseTo(rects[i]!.x, 9);
      expect(rects[i]!.y).toBeCloseTo(rects[0]!.y, 9);
      expect(rects[i + 3]!.y).toBeCloseTo(rects[3]!.y, 9);
    }
    expect(left(rects[0]!)).toBeLessThan(left(rects[1]!));
    expect(left(rects[1]!)).toBeLessThan(left(rects[2]!));
    expect(rects[0]!.y + rects[0]!.h).toBeLessThan(rects[3]!.y);
    expect(left(rects[0]!) + rects[0]!.w).toBeLessThan(left(rects[1]!));
  });

  it("keeps the grid under the title and inside the stage, each pane the same 16:10 size", () => {
    expect(top(rects[0]!)).toBeGreaterThanOrEqual(width * 0.12 - 1e-9);
    expect(top(rects[5]!) + rects[5]!.h).toBeLessThan((width * 9) / 16);
    for (const r of rects) {
      expect(r.w).toBeCloseTo(rects[0]!.w, 9);
      expect(r.h / r.w).toBeCloseTo(0.625, 9);
    }
  });

  it("leaves room for the agent's answer under the last row", () => {
    const bottom = top(rects[5]!) + rects[5]!.h;
    expect((width * 9) / 16 - bottom).toBeGreaterThan(width * 0.15);
  });

  it("follows the lens centre, so a pane stays where the stage puts it", () => {
    const moved = paneLayout(6, width, cy + 40, 500);
    expect(moved[0]!.y + cy + 40).toBeCloseTo(top(rects[0]!), 9);
    expect(moved[0]!.x + 500).toBeCloseTo(left(rects[0]!), 9);
  });

  it("fills a short last row from the left", () => {
    const five = paneLayout(5, width, cy, 480);
    expect(five).toHaveLength(5);
    expect(five[3]!.x).toBeCloseTo(five[0]!.x, 9);
    expect(five[4]!.x).toBeCloseTo(five[1]!.x, 9);
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
