import { sameInstantBattleCases } from "../../test";
import type { Interval } from "../../types";
import { intervalsOverlap } from "./intervalsOverlap";

// 2024-01-01 (unix2024Jan01T000000Ms); times of day override the canonical midnight because
// interval endpoints are the scenario under test. NY spellings name the same instants as Z(09/12/17).
const A = { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" };

describe("intervalsOverlap", () => {
  // Expected values derive from D5: a.start < b.end && b.start < a.end (hours on 2024-01-01 in Z).
  // Mixed zones: a = [09:00-05:00 = 14:00Z, 18:00+01:00 = 17:00Z), b = [15:00Z, 03:00+09:00 next
  // day = 18:00Z); 14 < 18 && 15 < 17 → true. Identical empties: 12 < 12 is false.
  it.each`
    aStart                                           | aEnd                                          | bStart                         | bEnd                                       | expected | reason
    ${"2024-01-01T09:00:00Z"}                        | ${"2024-01-01T17:00:00Z"}                     | ${"2024-01-01T12:00:00Z"}      | ${"2024-01-01T18:00:00Z"}                  | ${true}  | ${"partial"}
    ${"2024-01-01T09:00:00Z"}                        | ${"2024-01-01T17:00:00Z"}                     | ${"2024-01-01T17:00:00Z"}      | ${"2024-01-01T18:00:00Z"}                  | ${false} | ${"touching"}
    ${"2024-01-01T17:00:00Z"}                        | ${"2024-01-01T18:00:00Z"}                     | ${"2024-01-01T09:00:00Z"}      | ${"2024-01-01T17:00:00Z"}                  | ${false} | ${"touching, reversed"}
    ${"2024-01-01T09:00:00Z"}                        | ${"2024-01-01T12:00:00Z"}                     | ${"2024-01-01T13:00:00Z"}      | ${"2024-01-01T17:00:00Z"}                  | ${false} | ${"disjoint"}
    ${"2024-01-01T09:00:00Z"}                        | ${"2024-01-01T17:00:00Z"}                     | ${"2024-01-01T10:00:00Z"}      | ${"2024-01-01T11:00:00Z"}                  | ${true}  | ${"containment"}
    ${"2024-01-01T09:00:00Z"}                        | ${"2024-01-01T17:00:00Z"}                     | ${"2024-01-01T04:00:00-05:00"} | ${"2024-01-01T12:00:00-05:00"}             | ${true}  | ${"identical, different spelling"}
    ${"2024-01-01T09:00:00Z"}                        | ${"2024-01-01T09:00:00Z"}                     | ${"2024-01-01T09:00:00Z"}      | ${"2024-01-01T17:00:00Z"}                  | ${false} | ${"empty at start edge"}
    ${"2024-01-01T17:00:00Z"}                        | ${"2024-01-01T17:00:00Z"}                     | ${"2024-01-01T09:00:00Z"}      | ${"2024-01-01T17:00:00Z"}                  | ${false} | ${"empty at end edge"}
    ${"2024-01-01T12:00:00Z"}                        | ${"2024-01-01T12:00:00Z"}                     | ${"2024-01-01T09:00:00Z"}      | ${"2024-01-01T17:00:00Z"}                  | ${true}  | ${"empty strictly inside"}
    ${"2024-01-01T09:00:00Z"}                        | ${"2024-01-01T17:00:00Z"}                     | ${"2024-01-01T12:00:00Z"}      | ${"2024-01-01T12:00:00Z"}                  | ${true}  | ${"empty strictly inside, swapped"}
    ${"2024-01-01T12:00:00Z"}                        | ${"2024-01-01T12:00:00Z"}                     | ${"2024-01-01T07:00:00-05:00"} | ${"2024-01-01T07:00:00-05:00"}             | ${false} | ${"identical empties"}
    ${"2024-01-01T09:00:00Z"}                        | ${"2024-01-01T12:00:00.000000001Z"}           | ${"2024-01-01T12:00:00Z"}      | ${"2024-01-01T17:00:00Z"}                  | ${true}  | ${"1 ns overlap"}
    ${"2024-01-01T09:00:00-05:00[America/New_York]"} | ${"2024-01-01T18:00:00+01:00[Europe/Berlin]"} | ${"2024-01-01T15:00:00Z"}      | ${"2024-01-02T03:00:00+09:00[Asia/Tokyo]"} | ${true}  | ${"mixed zones"}
  `(
    "returns $expected for [$aStart, $aEnd) and [$bStart, $bEnd) ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      const a = { start: aStart, end: aEnd };
      const b = { start: bStart, end: bEnd };

      expect(intervalsOverlap(a, b)).toBe(expected);
      expect(intervalsOverlap(b, a)).toBe(expected);
    },
  );

  it.each(sameInstantBattleCases)(
    "returns false for an empty interval at $value against [$utc, 2024-02-29T01:00:00Z) ($timeZone)",
    ({ value, utc }) => {
      expect(
        intervalsOverlap(
          { start: value, end: value },
          { start: utc, end: "2024-02-29T01:00:00Z" },
        ),
      ).toBe(false);
    },
  );

  it.each`
    value
    ${null}
    ${undefined}
    ${"x"}
    ${123}
    ${[]}
  `("returns false when $value is non-object input", ({ value }) => {
    expect(intervalsOverlap(value as unknown as Interval, A)).toBe(false);
    expect(intervalsOverlap(A, value as unknown as Interval)).toBe(false);
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
  `("returns false when either interval is invalid ($reason)", ({ bad }) => {
    expect(intervalsOverlap(bad, A)).toBe(false);
    expect(intervalsOverlap(A, bad)).toBe(false);
  });
});
