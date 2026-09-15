import { intervalsOverlap } from "../compare";
import { sameInstantBattleCases } from "../../test";
import type { Interval } from "../../types";
import { intersectIntervals } from "./intersectIntervals";

// 2024-01-01 (unix2024Jan01T000000Ms); times of day override the canonical midnight because
// interval endpoints are the scenario under test. NY spellings name the same instants as Z(09/12/17).
const A = { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" };

describe("intersectIntervals", () => {
  // Expected values derive from D3/D5: null unless a.start < b.end && b.start < a.end; otherwise
  // start = a.start >= b.start ? a's text : b's, end = a.end <= b.end ? a's text : b's (ties → a).
  // Mixed zones: a = [14:00Z, 17:00Z), b = [15:00Z, 18:00Z); 14 >= 15 fails → b's "15:00Z";
  // 17 <= 18 holds → a's Berlin spelling of 17:00Z.
  it.each`
    aStart                                           | aEnd                                          | bStart                         | bEnd                                       | expectedStart                  | expectedEnd                                   | reason
    ${"2024-01-01T09:00:00Z"}                        | ${"2024-01-01T17:00:00Z"}                     | ${"2024-01-01T12:00:00Z"}      | ${"2024-01-01T18:00:00Z"}                  | ${"2024-01-01T12:00:00Z"}      | ${"2024-01-01T17:00:00Z"}                     | ${"partial"}
    ${"2024-01-01T09:00:00Z"}                        | ${"2024-01-01T17:00:00Z"}                     | ${"2024-01-01T10:00:00Z"}      | ${"2024-01-01T11:00:00Z"}                  | ${"2024-01-01T10:00:00Z"}      | ${"2024-01-01T11:00:00Z"}                     | ${"containment"}
    ${"2024-01-01T09:00:00Z"}                        | ${"2024-01-01T17:00:00Z"}                     | ${"2024-01-01T04:00:00-05:00"} | ${"2024-01-01T12:00:00-05:00"}             | ${"2024-01-01T09:00:00Z"}      | ${"2024-01-01T17:00:00Z"}                     | ${"identical, different spelling: a's"}
    ${"2024-01-01T04:00:00-05:00"}                   | ${"2024-01-01T12:00:00-05:00"}                | ${"2024-01-01T09:00:00Z"}      | ${"2024-01-01T17:00:00Z"}                  | ${"2024-01-01T04:00:00-05:00"} | ${"2024-01-01T12:00:00-05:00"}                | ${"identical, swapped: a's"}
    ${"2024-01-01T09:00:00Z"}                        | ${"2024-01-01T17:00:00Z"}                     | ${"2024-01-01T04:00:00-05:00"} | ${"2024-01-01T12:00:00Z"}                  | ${"2024-01-01T09:00:00Z"}      | ${"2024-01-01T12:00:00Z"}                     | ${"same start tie"}
    ${"2024-01-01T10:00:00Z"}                        | ${"2024-01-01T17:00:00Z"}                     | ${"2024-01-01T09:00:00Z"}      | ${"2024-01-01T12:00:00-05:00"}             | ${"2024-01-01T10:00:00Z"}      | ${"2024-01-01T17:00:00Z"}                     | ${"same end tie: a's"}
    ${"2024-01-01T09:00:00Z"}                        | ${"2024-01-01T12:00:00-05:00"}                | ${"2024-01-01T10:00:00Z"}      | ${"2024-01-01T17:00:00Z"}                  | ${"2024-01-01T10:00:00Z"}      | ${"2024-01-01T12:00:00-05:00"}                | ${"same end tie, swapped: a's"}
    ${"-271821-04-20T00:00:00Z"}                     | ${"+275760-09-13T00:00:00Z"}                  | ${"1970-01-01T00:00:00Z"}      | ${"+275760-09-13T00:00:00Z"}               | ${"1970-01-01T00:00:00Z"}      | ${"+275760-09-13T00:00:00Z"}                  | ${"full Instant range, end tie at the latest instant"}
    ${"2024-01-01T12:00:00Z"}                        | ${"2024-01-01T12:00:00Z"}                     | ${"2024-01-01T09:00:00Z"}      | ${"2024-01-01T17:00:00Z"}                  | ${"2024-01-01T12:00:00Z"}      | ${"2024-01-01T12:00:00Z"}                     | ${"empty inside"}
    ${"2024-01-01T09:00:00Z"}                        | ${"2024-01-01T17:00:00Z"}                     | ${"2024-01-01T12:00:00Z"}      | ${"2024-01-01T12:00:00Z"}                  | ${"2024-01-01T12:00:00Z"}      | ${"2024-01-01T12:00:00Z"}                     | ${"empty inside, swapped"}
    ${"2024-01-01T09:00:00Z"}                        | ${"2024-01-01T12:00:00.000000001Z"}           | ${"2024-01-01T12:00:00Z"}      | ${"2024-01-01T17:00:00Z"}                  | ${"2024-01-01T12:00:00Z"}      | ${"2024-01-01T12:00:00.000000001Z"}           | ${"1 ns overlap"}
    ${"2024-01-01T09:00:00-05:00[America/New_York]"} | ${"2024-01-01T18:00:00+01:00[Europe/Berlin]"} | ${"2024-01-01T15:00:00Z"}      | ${"2024-01-02T03:00:00+09:00[Asia/Tokyo]"} | ${"2024-01-01T15:00:00Z"}      | ${"2024-01-01T18:00:00+01:00[Europe/Berlin]"} | ${"mixed zones"}
  `(
    "returns [$expectedStart, $expectedEnd) for [$aStart, $aEnd) and [$bStart, $bEnd) ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expectedStart, expectedEnd }) => {
      const result = intersectIntervals(
        { start: aStart, end: aEnd },
        { start: bStart, end: bEnd },
      );

      expect(result).toEqual({ start: expectedStart, end: expectedEnd });
      expect(result?.start === expectedStart).toBe(true);
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                         | bEnd                           | reason
    ${"2024-01-01T09:00:00Z"} | ${"2024-01-01T17:00:00Z"} | ${"2024-01-01T17:00:00Z"}      | ${"2024-01-01T18:00:00Z"}      | ${"touching"}
    ${"2024-01-01T17:00:00Z"} | ${"2024-01-01T18:00:00Z"} | ${"2024-01-01T09:00:00Z"}      | ${"2024-01-01T17:00:00Z"}      | ${"touching, reversed"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-01-01T12:00:00Z"} | ${"2024-01-01T13:00:00Z"}      | ${"2024-01-01T17:00:00Z"}      | ${"disjoint"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-01-01T09:00:00Z"} | ${"2024-01-01T09:00:00Z"}      | ${"2024-01-01T17:00:00Z"}      | ${"empty at start edge"}
    ${"2024-01-01T17:00:00Z"} | ${"2024-01-01T17:00:00Z"} | ${"2024-01-01T09:00:00Z"}      | ${"2024-01-01T17:00:00Z"}      | ${"empty at end edge"}
    ${"2024-01-01T12:00:00Z"} | ${"2024-01-01T12:00:00Z"} | ${"2024-01-01T07:00:00-05:00"} | ${"2024-01-01T07:00:00-05:00"} | ${"identical empties"}
  `(
    "returns null for [$aStart, $aEnd) and [$bStart, $bEnd) ($reason)",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(
        intersectIntervals(
          { start: aStart, end: aEnd },
          { start: bStart, end: bEnd },
        ),
      ).toBeNull();
    },
  );

  it("returns a fresh object, never either argument", () => {
    const b = { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" };
    const result = intersectIntervals(A, b);

    expect(result).toEqual(A);
    expect(result).not.toBe(A);
    expect(result).not.toBe(b);
  });

  it.each(sameInstantBattleCases)(
    "returns the first argument's spelling when $value and $utc tie ($timeZone)",
    ({ value, utc }) => {
      const later = "2024-02-29T01:00:00Z";

      expect(
        intersectIntervals(
          { start: utc, end: later },
          { start: value, end: later },
        )?.start,
      ).toBe(utc);
      expect(
        intersectIntervals(
          { start: value, end: later },
          { start: utc, end: later },
        )?.start,
      ).toBe(value);
    },
  );

  it.each`
    value
    ${null}
    ${undefined}
    ${"x"}
    ${123}
    ${[]}
  `("returns null when $value is non-object input", ({ value }) => {
    expect(intersectIntervals(value as unknown as Interval, A)).toBeNull();
    expect(intersectIntervals(A, value as unknown as Interval)).toBeNull();
  });

  it.each`
    bad                                                                               | reason
    ${{}}                                                                             | ${"empty record"}
    ${{ start: "2024-01-01T09:00:00Z" }}                                              | ${"missing end"}
    ${{ start: 1, end: "2024-01-01T09:00:00Z" }}                                      | ${"non-string start"}
    ${{ start: "2024-01-01T17:00:00Z", end: "2024-01-01T09:00:00Z" }}                 | ${"inverted"}
    ${{ start: "2024-01-01T09:30:00Z", end: "2024-01-01T10:00:00+01:00" }}            | ${"inverted by instant, ascending as text"}
    ${{ start: "2016-12-31T23:59:60Z", end: "2017-01-01T00:00:00Z" }}                 | ${"leap second"}
    ${{ start: "2024-01-01T09:00:00Z[u-ca=iso8601]", end: "2024-01-01T17:00:00Z" }}   | ${"calendar annotation"}
    ${{ start: "2024-01-01T09:00:00", end: "2024-01-01T17:00:00Z" }}                  | ${"zoneless"}
    ${{ start: "2024-01-01T09:00:00[UTC]", end: "2024-01-01T17:00:00Z" }}             | ${"bracket-only zone"}
    ${{ start: "2024-01-01", end: "2024-01-01T17:00:00Z" }}                           | ${"date only"}
    ${{ start: "-271821-04-20T00:00:00Z", end: "+275760-09-13T00:00:00.000000001Z" }} | ${"past the Instant range"}
  `("returns null when either interval is invalid ($reason)", ({ bad }) => {
    expect(intersectIntervals(bad, A)).toBeNull();
    expect(intersectIntervals(A, bad)).toBeNull();
  });

  describe("overlap ⇔ intersect property", () => {
    // Every interval over these points with start ≤ end by instant: 16 intervals, including the
    // 7 empties (two of which spell 12:00Z differently at each end). Order is by instant rank.
    const points = [
      { text: "2024-01-01T09:00:00Z", rank: 0 },
      { text: "2024-01-01T07:00:00-05:00", rank: 1 },
      { text: "2024-01-01T12:00:00Z", rank: 1 },
      { text: "2024-01-01T12:00:00.000000001Z", rank: 2 },
      { text: "2024-01-01T17:00:00Z", rank: 3 },
    ];
    const intervals: Interval[] = points.flatMap((from) =>
      points
        .filter((to) => from.rank <= to.rank)
        .map((to) => ({ start: from.text, end: to.text })),
    );

    it("enumerates 16 intervals", () => {
      expect(intervals).toHaveLength(16);
    });

    it("agrees with intervalsOverlap and is symmetric across all 256 ordered pairs", () => {
      for (const a of intervals) {
        for (const b of intervals) {
          expect(intervalsOverlap(a, b)).toBe(
            intersectIntervals(a, b) !== null,
          );
          expect(intervalsOverlap(a, b)).toBe(intervalsOverlap(b, a));
        }
      }
    });
  });
});
