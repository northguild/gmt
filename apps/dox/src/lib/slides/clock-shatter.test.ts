import { FADE_END_MS } from "./ice-wall/shards";
import {
  CRACK_HOLD_MS,
  SHARD_COUNT,
  SHATTER_MS,
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
