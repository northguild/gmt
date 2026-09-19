import { intervalSplitAtUnix } from "./intervalSplitAtUnix";

describe("intervalSplitAtUnix", () => {
  // Half-open, coding-standards § 8 (A = 2024-01-01T09:00Z, B = 12:00Z, D = 17:00Z in ms): the same output as
  // before, now read as half-open pieces that partition [A, D) — B belongs only to [B, D).
  it("splits [A, D) at B into [A, B) and [B, D)", () => {
    expect(
      intervalSplitAtUnix(1704099600000, 1704128400000, [1704110400000]),
    ).toEqual([
      { start: 1704099600000, end: 1704110400000 },
      { start: 1704110400000, end: 1704128400000 },
    ]);
  });

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

  // Epoch values are whole units: a fractional point would produce pieces such as [0, 50000.5], and
  // an unsafe or empty value is not a valid epoch even when it would be filtered out of range.
  it.each`
    start  | end        | points         | description
    ${0}   | ${100000}  | ${[50000.5]}   | ${"a fractional point"}
    ${0}   | ${100000}  | ${["50000.5"]} | ${"a fractional numeric-string point"}
    ${0}   | ${100000}  | ${[""]}        | ${"an empty-string point, which Number() reads as 0"}
    ${0}   | ${100000}  | ${[2 ** 53]}   | ${"an unsafe point"}
    ${0}   | ${2 ** 53} | ${[50000]}     | ${"an unsafe end"}
    ${""}  | ${100000}  | ${[50000]}     | ${"an empty-string start"}
    ${"0"} | ${"1.5"}   | ${[1]}         | ${"a fractional numeric-string end"}
  `(
    "returns [] for [$start, $end] split at $points ($description)",
    ({ start, end, points }) => {
      expect(intervalSplitAtUnix(start, end, points)).toEqual([]);
    },
  );
});
