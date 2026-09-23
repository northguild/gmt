import { intervalAbutsUtc } from "./intervalAbutsUtc";

describe("intervalAbutsUtc", () => {
  // Half-open [start, end): two non-empty intervals abut when one's end equals the other's start —
  // they share no value and leave no gap (Allen's "meets"). An empty interval abuts nothing, and
  // there is no one-unit step, so a one-unit gap is a gap.
  // Half-open (coding-standards § 8): (A, B) abuts (B, D); (A, B) and (12:00:00.000000001Z, D) are 1 ns apart.
  it.each`
    aStart                              | aEnd                                | bStart                              | bEnd                                | expected
    ${"2024-01-01T09:00:00Z"}           | ${"2024-01-01T12:00:00Z"}           | ${"2024-01-01T12:00:00Z"}           | ${"2024-01-01T17:00:00Z"}           | ${true}
    ${"2024-01-01T09:00:00Z"}           | ${"2024-01-01T12:00:00Z"}           | ${"2024-01-01T12:00:00.000000001Z"} | ${"2024-01-01T17:00:00Z"}           | ${false}
    ${"2024-01-01T12:00:00Z"}           | ${"2024-01-01T17:00:00Z"}           | ${"2024-01-01T09:00:00Z"}           | ${"2024-01-01T12:00:00Z"}           | ${true}
    ${"2024-01-01T12:00:00Z"}           | ${"2024-01-01T12:00:00Z"}           | ${"2024-01-01T12:00:00Z"}           | ${"2024-01-01T17:00:00Z"}           | ${false}
    ${"2024-01-01T09:00:00Z"}           | ${"2024-06-30T12:00:00Z"}           | ${"2024-06-30T12:00:00.000000001Z"} | ${"2024-12-31T17:00:00Z"}           | ${false}
    ${"2024-06-30T12:00:00Z"}           | ${"2024-12-31T17:00:00Z"}           | ${"2024-01-01T09:00:00Z"}           | ${"2024-06-30T12:00:00.000000001Z"} | ${false}
    ${"2024-01-01T09:00:00Z"}           | ${"2024-01-01T09:00:00.000000001Z"} | ${"2024-01-01T09:00:00.000000002Z"} | ${"2024-12-31T17:00:00Z"}           | ${false}
    ${"2024-06-30T12:00:00.000000001Z"} | ${"2024-12-31T17:00:00Z"}           | ${"2024-01-01T09:00:00Z"}           | ${"2024-06-30T12:00:00Z"}           | ${false}
  `(
    "returns $expected when A=$aStart to $aEnd and B=$bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsUtc(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd                      | expected
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-06-30T12:00:01Z"} | ${"2024-12-31T17:00:00Z"} | ${false}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T13:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-12-31T17:00:00Z"} | ${false}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-04-01T11:00:00Z"} | ${"2024-08-01T13:00:00Z"} | ${false}
  `(
    "returns $expected for non-adjacent intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsUtc(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd                      | expected
    ${"2024-12-31T17:00:00Z"} | ${"2024-01-01T09:00:00Z"} | ${"2024-06-01T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${false}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-06-15T12:00:00Z"} | ${"2024-06-10T12:00:00Z"} | ${false}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsUtc(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd
    ${"invalid"}              | ${"2024-06-30T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${""}                     | ${"2024-06-30T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"invalid"}              | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${""}                     | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"invalid"}              | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${""}                     | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${"invalid"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${""}
  `(
    "returns false for malformed UTC datetime: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalAbutsUtc(aStart, aEnd, bStart, bEnd)).toBe(false);
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd
    ${null}                   | ${"2024-06-30T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${undefined}              | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${null}                   | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${undefined}
  `("returns false for non-string input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalAbutsUtc(aStart, aEnd, bStart, bEnd)).toBe(false);
  });

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd
    ${"2024-06-30T23:59:60Z"} | ${"2024-12-31T17:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T23:59:60Z"} | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-06-30T23:59:60Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${"2024-06-30T23:59:60Z"}
  `("returns false for leap second input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalAbutsUtc(aStart, aEnd, bStart, bEnd)).toBe(false);
  });

  // The last representable Instant is +275760-09-13T00:00:00Z. Abutting compares an end with a start
  // and never steps a nanosecond, so a 1 ns gap near the maximum is a gap and touching intervals
  // abut in either order without overflow.
  it.each`
    aStart                       | aEnd                                   | bStart                       | bEnd                                   | expected
    ${"+275760-09-12T12:00:00Z"} | ${"+275760-09-13T00:00:00Z"}           | ${"+275760-09-12T00:00:00Z"} | ${"+275760-09-12T11:59:59.999999999Z"} | ${false}
    ${"+275760-09-12T00:00:00Z"} | ${"+275760-09-12T11:59:59.999999999Z"} | ${"+275760-09-12T12:00:00Z"} | ${"+275760-09-13T00:00:00Z"}           | ${false}
    ${"+275760-09-13T00:00:00Z"} | ${"+275760-09-13T00:00:00Z"}           | ${"+275760-09-12T00:00:00Z"} | ${"+275760-09-12T11:59:59.999999999Z"} | ${false}
    ${"+275760-09-12T00:00:00Z"} | ${"+275760-09-12T12:00:00Z"}           | ${"+275760-09-12T12:00:00Z"} | ${"+275760-09-13T00:00:00Z"}           | ${true}
    ${"+275760-09-12T12:00:00Z"} | ${"+275760-09-13T00:00:00Z"}           | ${"+275760-09-12T00:00:00Z"} | ${"+275760-09-12T12:00:00Z"}           | ${true}
  `(
    "returns $expected when A=[$aStart, $aEnd] and B=[$bStart, $bEnd] (an end at the maximum Instant)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsUtc(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );
});
