import { FADE_END_MS } from "./ice-wall/shards";
import {
  CRACK_HOLD_MS,
  SHARD_COUNT,
  SHATTER_MS,
  drawnSquare,
  reaches,
  shardBox,
  shardClip,
  shardKeyframes,
  shatterCells,
} from "./clock-shatter";

describe("the clock's break", () => {
  it("breaks the same way every time, into its count of cells tiling the dial's box", () => {
    const cells = shatterCells();
    expect(cells).toEqual(shatterCells());
    expect(cells).toHaveLength(SHARD_COUNT);
    const area = cells.reduce((sum, cell) => sum + cell.area, 0);
    expect(area).toBeCloseTo(1, 6);
  });

  it("lasts the crack's hold and the wall's own flight", () => {
    expect(SHATTER_MS).toBe(CRACK_HOLD_MS + FADE_END_MS);
  });

  it("clips each shard to its cell, in percentages of the box", () => {
    const [cell] = shatterCells();
    const clip = shardClip(cell!);
    expect(clip).toMatch(/^polygon\(/);
    expect(clip.split(",")).toHaveLength(cell!.poly.length);
  });

  it("puts each shard in its cell's box, the clip in that box's percentages landing on the cell", () => {
    for (const cell of shatterCells()) {
      const b = shardBox(cell);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(1 + 1e-9);
      expect(b.y + b.h).toBeLessThanOrEqual(1 + 1e-9);
      const points = [...shardClip(cell).matchAll(/(-?[\d.]+)% (-?[\d.]+)%/g)];
      expect(points).toHaveLength(cell.poly.length);
      points.forEach(([, px, py], i) => {
        const [x, y] = cell.poly[i]!;
        expect(b.x + (Number(px) / 100) * b.w).toBeCloseTo(x, 5);
        expect(b.y + (Number(py) / 100) * b.h).toBeCloseTo(y, 5);
      });
    }
    // Twenty dial-sized layers were the break's first frame; the boxes add up to under two dials.
    const area = shatterCells().reduce((sum, c) => {
      const b = shardBox(c);
      return sum + b.w * b.h;
    }, 0);
    expect(area).toBeLessThan(2);
  });

  it("finds the dial's square drawing centred in a box of any shape", () => {
    expect(drawnSquare(325, 325)).toEqual([0, 0, 325]);
    expect(drawnSquare(325, 309)).toEqual([8, 0, 309]);
    expect(drawnSquare(200, 300)).toEqual([0, 50, 200]);
  });

  it("keeps a part of the dial in a shard when its box reaches the shard's, and drops it otherwise", () => {
    const shard = { x: 0.4, y: 0.4, w: 0.2, h: 0.2 };
    expect(reaches({ x: 0.5, y: 0.5, w: 0.01, h: 0.01 }, shard)).toBe(true);
    // A part just past the edge still reaches it: its shadow and stroke spill over.
    expect(reaches({ x: 0.61, y: 0.5, w: 0.05, h: 0.01 }, shard)).toBe(true);
    expect(reaches({ x: 0.7, y: 0.5, w: 0.05, h: 0.01 }, shard)).toBe(false);
    expect(reaches({ x: 0.5, y: 0.1, w: 0.01, h: 0.2 }, shard)).toBe(false);
    // A ray from the centre to the rim crosses it.
    expect(reaches({ x: 0.5, y: 0, w: 0.001, h: 0.5 }, shard)).toBe(true);
  });

  it.each(shatterCells().map((cell, i) => [i, cell] as const))(
    "starts shard %i as the dial stood and ends it gone",
    (_, cell) => {
      const frames = shardKeyframes(cell, 320);
      expect(frames[0]).toMatchObject({
        offset: 0,
        opacity: "1",
        transform: expect.stringMatching(
          /^translate3d\(0px, 0px, 0px\) rotate3d\(.*, 0rad\)$/,
        ),
      });
      expect(frames.at(-1)).toMatchObject({ offset: 1, opacity: "0" });
    },
  );

  it("flies every shard out from the centre", () => {
    for (const cell of shatterCells()) {
      const last = shardKeyframes(cell, 100).at(-1)!;
      const [, dx, dy] = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px/.exec(
        String(last["transform"]),
      )!;
      const out =
        Number(dx) * (cell.centroid[0] - 0.5) +
        Number(dy) * (cell.centroid[1] - 0.5);
      expect(out).toBeGreaterThan(0);
    }
  });
});
