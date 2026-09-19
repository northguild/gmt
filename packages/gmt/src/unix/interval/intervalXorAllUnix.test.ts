import { intervalXorAllUnix } from "./intervalXorAllUnix";
import { intervalXorUnix } from "./intervalXorUnix";

describe("intervalXorAllUnix", () => {
  it("reduces to the pairwise result for two overlapping intervals", () => {
    const a = { start: 0, end: 1500000000 };
    const b = { start: 1400000000, end: 1700000000 };

    const result = intervalXorAllUnix([a, b]);

    expect(result).toEqual(intervalXorUnix(a.start, a.end, b.start, b.end));
    expect(result).toEqual([
      { start: 0, end: 1400000000 },
      { start: 1500000000, end: 1700000000 },
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
    // A=[0,1000) B=[400,1400) C=[800,1800): [0,400)=1x, [400,800)=2x, [800,1000)=3x, [1000,1400)=2x, [1400,1800)=1x
    expect(
      intervalXorAllUnix([
        { start: 0, end: 1000 },
        { start: 400, end: 1400 },
        { start: 800, end: 1800 },
      ]),
    ).toEqual([
      { start: 0, end: 400 },
      { start: 800, end: 1000 },
      { start: 1400, end: 1800 },
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
      { start: 0, end: 400 },
      { start: 800, end: 1000 },
      { start: 1400, end: 1800 },
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

  // Epoch values are safe whole units; an empty string is not a numeric string.
  it.each`
    intervals                       | description
    ${[{ start: 0, end: 2 ** 53 }]} | ${"an unsafe end"}
    ${[{ start: "", end: "5" }]}    | ${"an empty-string start, which Number() reads as 0"}
    ${[{ start: "0", end: "1.5" }]} | ${"a fractional numeric-string end"}
  `("returns [] for $intervals ($description)", ({ intervals }) => {
    expect(intervalXorAllUnix(intervals)).toEqual([]);
  });

  // Half-open [start, end): each expected run is the values covered an odd number of times, merged
  // into maximal runs (coding-standards § 8; A = 2024-01-01T09:00Z, B = 12:00Z, C = 13:00Z,
  // D = 17:00Z in ms). The range-edge row (CORE-6) ends at Number.MAX_SAFE_INTEGER (2^53 - 1).
  it.each`
    intervals                                                                                                   | expected
    ${[{ start: 1704099600000, end: 1704114000000 }, { start: 1704110400000, end: 1704128400000 }]}             | ${[{ start: 1704099600000, end: 1704110400000 }, { start: 1704114000000, end: 1704128400000 }]}
    ${[{ start: 0, end: 10 }, { start: 3, end: 5 }]}                                                            | ${[{ start: 0, end: 3 }, { start: 5, end: 10 }]}
    ${[{ start: 0, end: 5 }, { start: 5, end: 10 }]}                                                            | ${[{ start: 0, end: 10 }]}
    ${[{ start: 0, end: 3 }, { start: 4, end: 6 }]}                                                             | ${[{ start: 0, end: 3 }, { start: 4, end: 6 }]}
    ${[{ start: 0, end: 10 }, { start: 5, end: 5 }]}                                                            | ${[{ start: 0, end: 10 }]}
    ${[{ start: 5, end: 5 }]}                                                                                   | ${[]}
    ${[{ start: 9007199254740980, end: 9007199254740991 }, { start: 9007199254740985, end: 9007199254740991 }]} | ${[{ start: 9007199254740980, end: 9007199254740985 }]}
  `(
    "returns $expected for half-open integer intervals $intervals",
    ({ intervals, expected }) => {
      expect(intervalXorAllUnix(intervals)).toEqual(expected);
    },
  );
});
