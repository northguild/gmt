import { intervalOverlappingDaysDate } from "./intervalOverlappingDaysDate";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";

describe("intervalOverlappingDaysDate", () => {
  // Half-open [start, end): the count is the days in the intersection [max(starts), min(ends)),
  // i.e. min(ends) - max(starts) in days; touching and empty intervals share no day.
  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2014-01-10"} | ${"2014-01-20"} | ${"2014-01-17"} | ${"2014-01-21"} | ${3}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"} | ${90}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"2024-02-01"} | ${"2024-02-29"} | ${28}
    ${"2024-02-28"} | ${"2024-03-01"} | ${"2024-02-29"} | ${"2024-03-05"} | ${1}
    ${"2023-02-28"} | ${"2023-03-01"} | ${"2023-02-27"} | ${"2023-03-05"} | ${1}
    ${"2024-12-31"} | ${"2025-01-02"} | ${"2025-01-01"} | ${"2025-01-05"} | ${1}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-29"} | ${"2024-12-31"} | ${1}
  `(
    "returns $expected shared dates for $aStart to $aEnd × $bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalOverlappingDaysDate(aStart, aEnd, bStart, bEnd)).toBe(
        expected,
      );
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-12-31"} | ${0}
    ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-06-30"} | ${0}
    ${"2024-06-30"} | ${"2024-06-30"} | ${"2024-01-01"} | ${"2024-06-30"} | ${0}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-03-01"} | ${"2024-03-01"} | ${0}
  `(
    "returns $expected for adjacent/identical $aStart to $aEnd × $bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalOverlappingDaysDate(aStart, aEnd, bStart, bEnd)).toBe(
        expected,
      );
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-07-01"} | ${"2024-12-31"}
    ${"2024-07-01"} | ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-06-30"}
  `(
    "returns 0 for disjoint $aStart to $aEnd × $bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalOverlappingDaysDate(aStart, aEnd, bStart, bEnd)).toBe(0);
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd
    ${"2024-06-30"} | ${"2024-01-01"} | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-15"} | ${"2024-06-10"}
  `(
    "returns null for inverted interval $aStart to $aEnd × $bStart to $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(
        intervalOverlappingDaysDate(aStart, aEnd, bStart, bEnd),
      ).toBeNull();
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd
    ${"invalid"}    | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"}
    ${""}           | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-13-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${"invalid"}    | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${""}           | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"invalid"}    | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${""}           | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${"invalid"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${""}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-13-01"}
  `(
    "returns null for malformed date: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(
        intervalOverlappingDaysDate(aStart, aEnd, bStart, bEnd),
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
        intervalOverlappingDaysDate(
          aStart as never,
          aEnd as never,
          bStart as never,
          bEnd as never,
        ),
      ).toBeNull();
    },
  );

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(
      intervalOverlappingDaysDate(
        "2024-01-01",
        "2024-06-30",
        "2024-04-01",
        "2024-12-31",
      ),
    ).toBeNull();
  });
  // E5 (issue #78): accepts RFC 9557 calendar-annotated PlainDate strings. The count is a day
  // difference, so all four arguments must name one calendar: different calendars return null,
  // as TC39 CalendarEquals makes until throw (native Chromium 153: "Mismatched
  // calendars."). Shared-calendar golden: 2024-10-03 up to 2024-10-31 is 28 days.
  it("counts days when all four arguments name the same calendar", () => {
    expect(
      intervalOverlappingDaysDate(
        "2024-10-01[u-ca=hebrew]",
        "2024-10-31[u-ca=hebrew]",
        "2024-10-03[u-ca=hebrew]",
        "2024-11-15[u-ca=hebrew]",
      ),
    ).toBe(28);
  });

  it.each`
    aStart          | aEnd            | bStart                       | bEnd
    ${"2024-10-01"} | ${"2024-10-31"} | ${"2024-10-03[u-ca=hebrew]"} | ${"2024-11-15"}
    ${"2024-10-01"} | ${"2024-10-31"} | ${"2024-12-01[u-ca=hebrew]"} | ${"2024-12-15[u-ca=hebrew]"}
  `(
    "returns null for $aStart to $aEnd and $bStart to $bEnd (different calendars)",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(
        intervalOverlappingDaysDate(aStart, aEnd, bStart, bEnd),
      ).toBeNull();
    },
  );
});
