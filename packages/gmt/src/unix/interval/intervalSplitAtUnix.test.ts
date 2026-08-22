import { intervalSplitAtUnix } from "./intervalSplitAtUnix";

describe("intervalSplitAtUnix", () => {
  it("splits at a single in-range point", () => {
    expect(intervalSplitAtUnix(0, 100000, [50000])).toEqual([
      { start: 0, end: 50000 },
      { start: 50000, end: 100000 },
    ]);
  });

  it("sorts unsorted points before splitting", () => {
    expect(intervalSplitAtUnix(0, 100000, [70000, 30000])).toEqual([
      { start: 0, end: 30000 },
      { start: 30000, end: 70000 },
      { start: 70000, end: 100000 },
    ]);
  });

  it("drops points outside the interval and on the boundaries", () => {
    expect(intervalSplitAtUnix(0, 100000, [0, 100000, 200000])).toEqual([
      { start: 0, end: 100000 },
    ]);
  });

  it("collapses duplicate points to a single boundary", () => {
    expect(intervalSplitAtUnix(0, 100000, [50000, 50000])).toEqual([
      { start: 0, end: 50000 },
      { start: 50000, end: 100000 },
    ]);
  });

  it("returns the whole interval unsplit for an empty points array", () => {
    expect(intervalSplitAtUnix(0, 100000, [])).toEqual([
      { start: 0, end: 100000 },
    ]);
  });

  it("accepts numeric strings for start, end, and points", () => {
    expect(intervalSplitAtUnix("0", "100000", ["50000"])).toEqual([
      { start: 0, end: 50000 },
      { start: 50000, end: 100000 },
    ]);
  });

  it("accepts a mix of number and numeric-string points", () => {
    expect(intervalSplitAtUnix(0, 100000, ["70000", 30000])).toEqual([
      { start: 0, end: 30000 },
      { start: 30000, end: 70000 },
      { start: 70000, end: 100000 },
    ]);
  });

  it.each`
    start     | end
    ${NaN}    | ${100000}
    ${100000} | ${0}
  `("returns [] for invalid $start, $end", ({ start, end }) => {
    expect(intervalSplitAtUnix(start, end, [50000])).toEqual([]);
  });

  it.each`
    points
    ${"not-an-array"}
    ${[NaN]}
    ${[null]}
    ${["not-a-number"]}
    ${[Infinity]}
  `("returns [] for invalid points $points", ({ points }) => {
    expect(intervalSplitAtUnix(0, 100000, points)).toEqual([]);
  });
});
