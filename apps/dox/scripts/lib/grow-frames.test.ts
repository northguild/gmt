import { describe, expect, it } from "vitest";
import { maxFrameJump } from "../gate-checks.mjs";
import { settledMainHeights } from "./grow-frames.mjs";

describe("settledMainHeights", () => {
  it("drops frames drawn while the parser was still streaming the page", () => {
    // The Canada page: the first frame lacks the footer that streams in next.
    const frames = [
      { l: 1, m: 5708 },
      { l: 1, m: 5955 },
      { l: 0, m: 5955 },
      { l: 0, m: 5955 },
    ];
    expect(maxFrameJump(frames.map((f) => f.m))).toBe(247);
    expect(maxFrameJump(settledMainHeights(frames))).toBe(0);
  });

  it("still sees a jump after the parser has finished", () => {
    const frames = [
      { l: 0, m: 5955 },
      { l: 0, m: 6203 },
    ];
    expect(maxFrameJump(settledMainHeights(frames))).toBe(248);
  });

  it("counts a frame with no parser flag as finished", () => {
    expect(settledMainHeights([{ m: 10 }, { m: 70 }])).toEqual([10, 70]);
  });
});
