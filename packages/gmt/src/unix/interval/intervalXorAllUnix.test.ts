import { intervalXorAllUnix } from "./intervalXorAllUnix";
import { intervalXorUnix } from "./intervalXorUnix";

describe("intervalXorAllUnix", () => {
  it("reduces to the pairwise result for two overlapping intervals", () => {
    const a = { start: 0, end: 1500000000 };
    const b = { start: 1400000000, end: 1700000000 };

    const result = intervalXorAllUnix([a, b]);

    expect(result).toEqual(intervalXorUnix(a.start, a.end, b.start, b.end));
    expect(result).toEqual([
      { start: 0, end: 1399999999 },
      { start: 1500000001, end: 1700000000 },
    ]);
  });

  it("returns both intervals unchanged for two disjoint intervals", () => {
    expect(
      intervalXorAllUnix([
        { start: 0, end: 100 },
        { start: 200, end: 300 },
      ]),
    ).toEqual([
      { start: 0, end: 100 },
      { start: 200, end: 300 },
    ]);
  });

  it("returns [] when two identical intervals cancel out", () => {
    expect(
      intervalXorAllUnix([
        { start: 0, end: 1000000 },
        { start: 0, end: 1000000 },
      ]),
    ).toEqual([]);
  });

  it("returns the single interval unchanged for a one-element list", () => {
    expect(intervalXorAllUnix([{ start: 0, end: 100 }])).toEqual([
      { start: 0, end: 100 },
    ]);
  });

  it("returns [] for an empty list", () => {
    expect(intervalXorAllUnix([])).toEqual([]);
  });

  it("handles a 3-way overlap, keeping only oddly-covered regions (odd-vs-even sweep)", () => {
    // A=[0,1000] B=[400,1400] C=[800,1800]: [0,399]=1x, [400,799]=2x, [800,1000]=3x, [1001,1400]=2x, [1401,1800]=1x
    expect(
      intervalXorAllUnix([
        { start: 0, end: 1000 },
        { start: 400, end: 1400 },
        { start: 800, end: 1800 },
      ]),
    ).toEqual([
      { start: 0, end: 399 },
      { start: 800, end: 1000 },
      { start: 1401, end: 1800 },
    ]);
  });

  it("does not depend on input order for a 3-way overlap", () => {
    expect(
      intervalXorAllUnix([
        { start: 800, end: 1800 },
        { start: 0, end: 1000 },
        { start: 400, end: 1400 },
      ]),
    ).toEqual([
      { start: 0, end: 399 },
      { start: 800, end: 1000 },
      { start: 1401, end: 1800 },
    ]);
  });

  it("accepts numeric-string start/end values", () => {
    expect(intervalXorAllUnix([{ start: "0", end: "100" }])).toEqual([
      { start: 0, end: 100 },
    ]);
  });

  it.each`
    intervals
    ${"not-an-array"}
    ${[{ start: 1000000, end: 0 }]}
    ${[{ start: "not-a-number", end: 100 }]}
    ${[{ start: 0, end: 100 }, "not-an-object"]}
  `("returns [] for invalid intervals $intervals", ({ intervals }) => {
    expect(intervalXorAllUnix(intervals)).toEqual([]);
  });
});
