import {
  CRACK_FADE_MS,
  CRACK_MS,
  DOT_SCALE,
  FADE_END_MS,
  PIN_FIRST_MS,
  PIN_LAST_MS,
  PIN_START_MS,
  arrivalMs,
  crackPose,
  pinnedPose,
  shardPose,
} from "./shards";
import { cells, hashSeed } from "./voronoi";

const SEED = hashSeed("momentjs");
const all = cells(SEED, 24);
const cell = all[3]!;

describe("shardPose", () => {
  it("is the cell at rest at t = 0", () => {
    for (const c of all) {
      const pose = shardPose(c, SEED, 0);
      expect(pose.dx).toBeCloseTo(0, 12);
      expect(pose.dy).toBeCloseTo(0, 12);
      expect(pose.dz).toBeCloseTo(0, 12);
      expect(pose.angle).toBeCloseTo(0, 12);
      expect(pose.opacity).toBe(1);
    }
  });

  it("is clear by 1400 ms and stays clear", () => {
    expect(shardPose(cell, SEED, FADE_END_MS).opacity).toBe(0);
    expect(shardPose(cell, SEED, FADE_END_MS + 5000).opacity).toBe(0);
    expect(shardPose(cell, SEED, 800).opacity).toBeLessThan(1);
  });

  it("flies away from the impact and towards the camera, ever more slowly", () => {
    const impact = [0.5, 0.5] as const;
    const away = (t: number) => {
      const p = shardPose(cell, SEED, t, impact);
      return (
        p.dx * (cell.centroid[0] - impact[0]) +
        p.dy * (cell.centroid[1] - impact[1])
      );
    };
    expect(away(300)).toBeGreaterThan(0);
    expect(shardPose(cell, SEED, 300, impact).dz).toBeGreaterThan(0);
    const step1 = away(300) - away(0);
    const step2 = away(1500) - away(1200);
    expect(step2).toBeLessThan(step1);
  });

  it("is deterministic: the same inputs give the same pose, in any order", () => {
    const a = shardPose(cell, SEED, 420);
    shardPose(cell, SEED, 900);
    expect(shardPose(cell, SEED, 420)).toEqual(a);
    expect(shardPose(cell, SEED + 1, 420)).not.toEqual(a);
  });

  it("returns a unit spin axis", () => {
    const [x, y, z] = shardPose(cell, SEED, 100).axis;
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 12);
  });
});

describe("pinnedPose", () => {
  const from = [100, 80] as const;
  const to = [640, 300] as const;

  it("starts where the shard was and ends on the target point as a dot", () => {
    const start = pinnedPose(from, to, PIN_START_MS, 1200, 0.2);
    expect(start.x).toBeCloseTo(100, 9);
    expect(start.y).toBeCloseTo(80, 9);
    expect(start.scale).toBe(1);
    expect(start.arrived).toBe(false);
    const end = pinnedPose(from, to, 1200, 1200, 0.2);
    expect(end.x).toBeCloseTo(640, 9);
    expect(end.y).toBeCloseTo(300, 9);
    expect(end.scale).toBeCloseTo(DOT_SCALE, 9);
    expect(end.arrived).toBe(true);
    expect(end.opacity).toBe(0);
  });

  it("is deterministic and holds the target after arrival", () => {
    expect(pinnedPose(from, to, 900, 1200, 0.2)).toEqual(
      pinnedPose(from, to, 900, 1200, 0.2),
    );
    expect(pinnedPose(from, to, 5000, 1200, 0.2).x).toBeCloseTo(640, 9);
  });

  it("bows the path to one side", () => {
    const mid = pinnedPose(from, to, 850, 1200, 0.3);
    const straight = pinnedPose(from, to, 850, 1200, 0);
    expect(Math.hypot(mid.x - straight.x, mid.y - straight.y)).toBeGreaterThan(
      1,
    );
  });

  it("gives every shard an arrival inside the window", () => {
    for (const c of all) {
      const at = arrivalMs(c, SEED);
      expect(at).toBeGreaterThanOrEqual(PIN_FIRST_MS);
      expect(at).toBeLessThanOrEqual(PIN_LAST_MS);
    }
  });
});

describe("crackPose", () => {
  it("cracks, then fades, and is clear after both", () => {
    expect(crackPose(0)).toEqual({ cracks: 0, opacity: 1 });
    expect(crackPose(CRACK_MS)).toEqual({ cracks: 1, opacity: 1 });
    expect(crackPose(CRACK_MS + CRACK_FADE_MS).opacity).toBe(0);
  });
});
