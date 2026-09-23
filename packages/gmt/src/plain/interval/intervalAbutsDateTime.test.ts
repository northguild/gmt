import { intervalAbutsDateTime } from "./intervalAbutsDateTime";

describe("intervalAbutsDateTime", () => {
  // Half-open [start, end): two non-empty intervals abut when one's end equals the other's start —
  // they share no value and leave no gap (Allen's "meets"). An empty interval abuts nothing, and
  // there is no one-unit step, so a one-unit gap is a gap.
  it.each`
    aStart                             | aEnd                               | bStart                             | bEnd                               | expected
    ${"2024-01-01T09:00:00"}           | ${"2024-06-30T12:00:00"}           | ${"2024-06-30T12:00:00.000000001"} | ${"2024-12-31T17:00:00"}           | ${false}
    ${"2024-06-30T12:00:00"}           | ${"2024-12-31T17:00:00"}           | ${"2024-01-01T09:00:00"}           | ${"2024-06-30T12:00:00.000000001"} | ${false}
    ${"2024-01-01T09:00:00"}           | ${"2024-01-01T09:00:00.000000001"} | ${"2024-01-01T09:00:00.000000002"} | ${"2024-12-31T17:00:00"}           | ${false}
    ${"2024-06-30T12:00:00.000000001"} | ${"2024-12-31T17:00:00"}           | ${"2024-01-01T09:00:00"}           | ${"2024-06-30T12:00:00"}           | ${false}
    ${"2024-01-01T09:00:00"}           | ${"2024-06-30T12:00:00"}           | ${"2024-06-30T12:00:00"}           | ${"2024-12-31T17:00:00"}           | ${true}
    ${"2024-06-30T12:00:00"}           | ${"2024-12-31T17:00:00"}           | ${"2024-01-01T09:00:00"}           | ${"2024-06-30T12:00:00"}           | ${true}
    ${"2024-01-01T09:00:00"}           | ${"2024-01-01T09:00:00"}           | ${"2024-01-01T09:00:00"}           | ${"2024-01-01T17:00:00"}           | ${false}
  `(
    "returns $expected when A=$aStart to $aEnd and B=$bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsDateTime(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd                     | expected
    ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${"2024-06-30T12:00:01"} | ${"2024-12-31T17:00:00"} | ${false}
    ${"2024-01-01T09:00:00"} | ${"2024-06-30T13:00:00"} | ${"2024-06-30T12:00:00"} | ${"2024-12-31T17:00:00"} | ${false}
    ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${"2024-04-01T11:00:00"} | ${"2024-08-01T13:00:00"} | ${false}
  `(
    "returns $expected for non-adjacent intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsDateTime(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd                     | expected
    ${"2024-12-31T17:00:00"} | ${"2024-01-01T09:00:00"} | ${"2024-06-01T12:00:00"} | ${"2024-07-01T13:00:00"} | ${false}
    ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${"2024-06-15T12:00:00"} | ${"2024-06-10T12:00:00"} | ${false}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsDateTime(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd
    ${"invalid"}             | ${"2024-06-30T12:00:00"} | ${"2024-07-01T13:00:00"} | ${"2024-12-31T17:00:00"}
    ${""}                    | ${"2024-06-30T12:00:00"} | ${"2024-07-01T13:00:00"} | ${"2024-12-31T17:00:00"}
    ${"2024-01-01T09:00:00"} | ${"invalid"}             | ${"2024-07-01T13:00:00"} | ${"2024-12-31T17:00:00"}
    ${"2024-01-01T09:00:00"} | ${""}                    | ${"2024-07-01T13:00:00"} | ${"2024-12-31T17:00:00"}
    ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${"invalid"}             | ${"2024-12-31T17:00:00"}
    ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${""}                    | ${"2024-12-31T17:00:00"}
    ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${"2024-07-01T13:00:00"} | ${"invalid"}
    ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${"2024-07-01T13:00:00"} | ${""}
  `(
    "returns false for malformed datetime: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalAbutsDateTime(aStart, aEnd, bStart, bEnd)).toBe(false);
    },
  );

  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd
    ${null}                  | ${"2024-06-30T12:00:00"} | ${"2024-07-01T13:00:00"} | ${"2024-12-31T17:00:00"}
    ${"2024-01-01T09:00:00"} | ${undefined}             | ${"2024-07-01T13:00:00"} | ${"2024-12-31T17:00:00"}
    ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${null}                  | ${"2024-12-31T17:00:00"}
    ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${"2024-07-01T13:00:00"} | ${undefined}
  `("returns false for non-string input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalAbutsDateTime(aStart, aEnd, bStart, bEnd)).toBe(false);
  });

  // The last representable PlainDateTime is +275760-09-13T23:59:59.999999999. Abutting compares an
  // end with a start and never steps a nanosecond, so a 1 ns gap near the maximum is a gap and
  // touching intervals abut in either order without overflow.
  it.each`
    aStart                                | aEnd                                  | bStart                      | bEnd                                  | expected
    ${"+275760-09-13T12:00:00"}           | ${"+275760-09-13T23:59:59.999999999"} | ${"+275760-09-13T00:00:00"} | ${"+275760-09-13T11:59:59.999999999"} | ${false}
    ${"+275760-09-13T00:00:00"}           | ${"+275760-09-13T11:59:59.999999999"} | ${"+275760-09-13T12:00:00"} | ${"+275760-09-13T23:59:59.999999999"} | ${false}
    ${"+275760-09-13T23:59:59.999999999"} | ${"+275760-09-13T23:59:59.999999999"} | ${"+275760-09-13T00:00:00"} | ${"+275760-09-13T11:59:59.999999999"} | ${false}
    ${"+275760-09-13T00:00:00"}           | ${"+275760-09-13T12:00:00"}           | ${"+275760-09-13T12:00:00"} | ${"+275760-09-13T23:59:59.999999999"} | ${true}
    ${"+275760-09-13T12:00:00"}           | ${"+275760-09-13T23:59:59.999999999"} | ${"+275760-09-13T00:00:00"} | ${"+275760-09-13T12:00:00"}           | ${true}
  `(
    "returns $expected when A=[$aStart, $aEnd] and B=[$bStart, $bEnd] (an end at the maximum PlainDateTime)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsDateTime(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );
});
