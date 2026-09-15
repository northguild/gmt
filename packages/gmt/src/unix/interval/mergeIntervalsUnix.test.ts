import { mergeIntervalsUnix } from "./mergeIntervalsUnix";

describe("mergeIntervalsUnix", () => {
  it.each`
    aStart     | aEnd       | bStart     | bEnd       | expected
    ${0}       | ${1000000} | ${500000}  | ${1500000} | ${[{ start: 0, end: 1500000 }]}
    ${0}       | ${1000000} | ${1000000} | ${2000000} | ${[{ start: 0, end: 2000000 }]}
    ${0}       | ${1000000} | ${2000000} | ${3000000} | ${[{ start: 0, end: 1000000 }, { start: 2000000, end: 3000000 }]}
    ${0}       | ${999999}  | ${1000000} | ${2000000} | ${[{ start: 0, end: 999999 }, { start: 1000000, end: 2000000 }]}
    ${0}       | ${3000000} | ${1000000} | ${2000000} | ${[{ start: 0, end: 3000000 }]}
    ${2000000} | ${3000000} | ${0}       | ${1000000} | ${[{ start: 0, end: 1000000 }, { start: 2000000, end: 3000000 }]}
  `(
    "merges [$aStart,$aEnd] and [$bStart,$bEnd] into $expected",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(
        mergeIntervalsUnix([
          { start: aStart, end: aEnd },
          { start: bStart, end: bEnd },
        ]),
      ).toEqual(expected);
    },
  );

  it("returns [] for an empty list", () => {
    expect(mergeIntervalsUnix([])).toEqual([]);
  });

  it.each`
    intervals
    ${"not-an-array"}
    ${[{ start: 1000000, end: 0 }]}
    ${[{ start: NaN, end: 1000000 }]}
    ${[{ start: 1000000.5, end: 2000000 }]}
    ${[{ start: 0, end: 1000000 }, "not-an-object"]}
  `("returns [] for invalid intervals $intervals", ({ intervals }) => {
    expect(mergeIntervalsUnix(intervals)).toEqual([]);
  });

  // Epoch values are safe whole units; an empty string is not a numeric string.
  it.each`
    intervals                       | description
    ${[{ start: 0, end: 2 ** 53 }]} | ${"an unsafe end"}
    ${[{ start: "", end: "5" }]}    | ${"an empty-string start, which Number() reads as 0"}
    ${[{ start: "0", end: "1.5" }]} | ${"a fractional numeric-string end"}
  `("returns [] for $intervals ($description)", ({ intervals }) => {
    expect(mergeIntervalsUnix(intervals)).toEqual([]);
  });
});
