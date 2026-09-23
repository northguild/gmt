import { intervalOverlappingDaysDateTime } from "./intervalOverlappingDaysDateTime";
import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";

describe("intervalOverlappingDaysDateTime", () => {
  // Half-open [start, end): the count is the calendar days holding at least one moment of the
  // intersection [max(starts), min(ends)). An intersection ending exactly at midnight does not
  // reach that day; touching and empty intervals share no moment, so they count 0.
  it.each`
    aStart                             | aEnd                                  | bStart                      | bEnd                                  | expected
    ${"2024-01-01T23:59:00"}           | ${"2024-01-02T00:01:00"}              | ${"2024-01-01T23:59:00"}    | ${"2024-01-02T00:01:00"}              | ${2}
    ${"2024-01-01T00:00:00"}           | ${"2024-01-05T00:00:00"}              | ${"2024-01-03T12:00:00"}    | ${"2024-01-09T00:00:00"}              | ${2}
    ${"2014-01-10T00:00:00"}           | ${"2014-01-20T00:00:00"}              | ${"2014-01-17T00:00:00"}    | ${"2014-01-21T00:00:00"}              | ${3}
    ${"2024-01-01T00:00:00"}           | ${"2024-01-02T00:00:00"}              | ${"2024-01-01T00:00:00"}    | ${"2024-01-02T00:00:00"}              | ${1}
    ${"2024-01-01T23:59:59.999999999"} | ${"2024-01-03T00:00:00"}              | ${"2024-01-01T00:00:00"}    | ${"2024-01-02T00:00:00.000000001"}    | ${2}
    ${"+275760-09-13T00:00:00"}        | ${"+275760-09-13T23:59:59.999999999"} | ${"+275760-09-12T00:00:00"} | ${"+275760-09-13T23:59:59.999999999"} | ${1}
  `(
    "returns $expected shared dates for $aStart to $aEnd × $bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalOverlappingDaysDateTime(aStart, aEnd, bStart, bEnd)).toBe(
        expected,
      );
    },
  );

  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd                     | expected
    ${"2024-01-01T12:00:00"} | ${"2024-01-01T12:00:00"} | ${"2024-01-01T12:00:00"} | ${"2024-01-01T12:00:00"} | ${0}
    ${"2024-01-01T00:00:00"} | ${"2024-01-02T00:00:00"} | ${"2024-01-02T00:00:00"} | ${"2024-01-03T00:00:00"} | ${0}
    ${"2024-01-01T09:00:00"} | ${"2024-01-01T17:00:00"} | ${"2024-01-01T12:00:00"} | ${"2024-01-01T12:00:00"} | ${0}
  `(
    "returns $expected for adjacent/identical $aStart to $aEnd × $bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalOverlappingDaysDateTime(aStart, aEnd, bStart, bEnd)).toBe(
        expected,
      );
    },
  );

  it.each`
    aStart                   | aEnd                     | bStart                       | bEnd
    ${"2024-01-01T00:00:00"} | ${"2024-01-02T00:00:00"} | ${"2024-01-02T00:00:00.001"} | ${"2024-01-03T00:00:00"}
  `(
    "returns 0 for disjoint $aStart to $aEnd × $bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalOverlappingDaysDateTime(aStart, aEnd, bStart, bEnd)).toBe(
        0,
      );
    },
  );

  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd
    ${"2024-06-30T00:00:00"} | ${"2024-01-01T00:00:00"} | ${"2024-04-01T00:00:00"} | ${"2024-12-31T23:59:59"}
    ${"2024-01-01T00:00:00"} | ${"2024-06-30T00:00:00"} | ${"2024-06-15T00:00:00"} | ${"2024-06-10T00:00:00"}
  `(
    "returns null for inverted interval $aStart to $aEnd × $bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(
        intervalOverlappingDaysDateTime(aStart, aEnd, bStart, bEnd),
      ).toBeNull();
    },
  );

  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd
    ${"invalid"}             | ${"2024-06-30T23:59:59"} | ${"2024-04-01T00:00:00"} | ${"2024-12-31T23:59:59"}
    ${""}                    | ${"2024-06-30T23:59:59"} | ${"2024-04-01T00:00:00"} | ${"2024-12-31T23:59:59"}
    ${"2024-01-01T00:00:00"} | ${"invalid"}             | ${"2024-04-01T00:00:00"} | ${"2024-12-31T23:59:59"}
    ${"2024-01-01T00:00:00"} | ${""}                    | ${"2024-04-01T00:00:00"} | ${"2024-12-31T23:59:59"}
    ${"2024-01-01T00:00:00"} | ${"2024-06-30T23:59:59"} | ${"invalid"}             | ${"2024-12-31T23:59:59"}
    ${"2024-01-01T00:00:00"} | ${"2024-06-30T23:59:59"} | ${""}                    | ${"2024-12-31T23:59:59"}
    ${"2024-01-01T00:00:00"} | ${"2024-06-30T23:59:59"} | ${"2024-04-01T00:00:00"} | ${"invalid"}
    ${"2024-01-01T00:00:00"} | ${"2024-06-30T23:59:59"} | ${"2024-04-01T00:00:00"} | ${""}
  `(
    "returns null for malformed datetime: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(
        intervalOverlappingDaysDateTime(aStart, aEnd, bStart, bEnd),
      ).toBeNull();
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd
    ${null}         | ${"2024-01-01"} | ${"2024-01-01"} | ${null}
    ${"2024-01-01"} | ${null}         | ${"2024-01-01"} | ${null}
    ${"2024-01-01"} | ${"2024-01-01"} | ${null}         | ${null}
  `(
    "returns null for non-string input: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(
        intervalOverlappingDaysDateTime(
          aStart as never,
          aEnd as never,
          bStart as never,
          bEnd as never,
        ),
      ).toBeNull();
    },
  );

  it("returns null when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(
      intervalOverlappingDaysDateTime(
        "2024-01-01T00:00:00",
        "2024-06-30T23:59:59",
        "2024-04-01T00:00:00",
        "2024-12-31T23:59:59",
      ),
    ).toBeNull();
  });
});
