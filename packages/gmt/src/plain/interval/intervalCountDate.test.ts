import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { intervalCountDate } from "./intervalCountDate";

describe("intervalCountDate", () => {
  it.each`
    start           | end             | unit       | expected
    ${"2024-01-01"} | ${"2024-01-03"} | ${"day"}   | ${2}
    ${"2024-01-01"} | ${"2024-01-02"} | ${"day"}   | ${1}
    ${"2024-01-15"} | ${"2024-03-10"} | ${"month"} | ${3}
    ${"2024-01-01"} | ${"2024-03-01"} | ${"month"} | ${2}
    ${"2024-01-04"} | ${"2024-01-15"} | ${"week"}  | ${2}
    ${"2024-01-01"} | ${"2024-01-08"} | ${"week"}  | ${1}
    ${"2024-12-31"} | ${"2025-01-01"} | ${"year"}  | ${1}
    ${"2024-01-01"} | ${"2026-01-01"} | ${"year"}  | ${2}
    ${"2024-06-15"} | ${"2025-06-15"} | ${"year"}  | ${2}
  `(
    "returns $expected $unit boundaries for $start to $end",
    ({ start, end, unit, expected }) => {
      expect(intervalCountDate(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start           | end             | unit        | expected
    ${"2024-01-01"} | ${"2024-01-03"} | ${"days"}   | ${2}
    ${"2024-01-15"} | ${"2024-03-10"} | ${"months"} | ${3}
    ${"2024-01-04"} | ${"2024-01-15"} | ${"weeks"}  | ${2}
    ${"2024-01-01"} | ${"2026-01-01"} | ${"years"}  | ${2}
  `(
    "returns $expected for $start to $end with plural unit $unit",
    ({ start, end, unit, expected }) => {
      expect(intervalCountDate(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start           | end             | unit       | expected
    ${"2024-01-01"} | ${"2024-01-01"} | ${"day"}   | ${0}
    ${"2024-01-15"} | ${"2024-01-15"} | ${"day"}   | ${0}
    ${"2024-01-15"} | ${"2024-01-15"} | ${"month"} | ${0}
    ${"2024-01-04"} | ${"2024-01-04"} | ${"week"}  | ${0}
    ${"2024-06-15"} | ${"2024-06-15"} | ${"year"}  | ${0}
    ${"2024-01-01"} | ${"2024-01-01"} | ${"month"} | ${0}
    ${"2024-01-01"} | ${"2024-01-01"} | ${"year"}  | ${0}
  `(
    "returns $expected for zero-length $start to $end counted in $unit (an empty interval holds no instant)",
    ({ start, end, unit, expected }) => {
      expect(intervalCountDate(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start           | end             | unit      | expected
    ${"2024-02-28"} | ${"2024-03-01"} | ${"day"}  | ${2}
    ${"2024-02-29"} | ${"2024-03-01"} | ${"day"}  | ${1}
    ${"2023-12-31"} | ${"2024-01-01"} | ${"day"}  | ${1}
    ${"2024-12-30"} | ${"2025-01-06"} | ${"week"} | ${1}
  `(
    "returns $expected for boundary case $start to $end counted in $unit",
    ({ start, end, unit, expected }) => {
      expect(intervalCountDate(start, end, unit)).toBe(expected);
    },
  );

  // -271821-04-19 is the first representable PlainDate; its month and year began before the range,
  // but the buckets it touches can still be counted. April and May: 2; one April day alone: 1. Years -271821 and -271820: 2,
  // or 1 when the end sits exactly on 1 January -271820.
  it.each`
    start              | end                | unit       | expected
    ${"-271821-04-19"} | ${"-271821-05-10"} | ${"month"} | ${2}
    ${"-271821-04-19"} | ${"-271821-04-20"} | ${"month"} | ${1}
    ${"-271821-04-19"} | ${"-271820-02-01"} | ${"year"}  | ${2}
    ${"-271821-04-19"} | ${"-271820-01-01"} | ${"year"}  | ${1}
  `(
    "returns $expected $unit buckets for [$start, $end) starting on the first PlainDate",
    ({ start, end, unit, expected }) => {
      expect(intervalCountDate(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start           | end             | unit
    ${"invalid"}    | ${"2024-01-10"} | ${"day"}
    ${""}           | ${"2024-01-10"} | ${"day"}
    ${"2024-13-01"} | ${"2024-01-10"} | ${"day"}
    ${"2024-01-01"} | ${"invalid"}    | ${"day"}
    ${"2024-01-01"} | ${""}           | ${"day"}
    ${"2024-01-01"} | ${"2024-02-30"} | ${"day"}
    ${"2024-01-10"} | ${"2024-01-01"} | ${"day"}
    ${"2024-01-01"} | ${"2024-01-10"} | ${"invalid"}
    ${"2024-01-01"} | ${"2024-01-10"} | ${""}
    ${"2024-01-01"} | ${"2024-01-10"} | ${"hour"}
    ${"2024-01-01"} | ${"2024-01-10"} | ${"hours"}
    ${"2024-01-01"} | ${"2024-01-10"} | ${"nanosecond"}
  `(
    "returns null for invalid $start, $end, or $unit",
    ({ start, end, unit }) => {
      expect(intervalCountDate(start, end, unit)).toBeNull();
    },
  );

  it.each`
    start           | end             | unit
    ${null}         | ${"2024-01-10"} | ${"day"}
    ${undefined}    | ${"2024-01-10"} | ${"day"}
    ${123}          | ${"2024-01-10"} | ${"day"}
    ${true}         | ${"2024-01-10"} | ${"day"}
    ${[]}           | ${"2024-01-10"} | ${"day"}
    ${{}}           | ${"2024-01-10"} | ${"day"}
    ${"2024-01-01"} | ${null}         | ${"day"}
    ${"2024-01-01"} | ${undefined}    | ${"day"}
    ${"2024-01-01"} | ${123}          | ${"day"}
    ${"2024-01-01"} | ${true}         | ${"day"}
    ${"2024-01-01"} | ${[]}           | ${"day"}
    ${"2024-01-01"} | ${{}}           | ${"day"}
    ${"2024-01-01"} | ${"2024-01-10"} | ${null}
    ${"2024-01-01"} | ${"2024-01-10"} | ${undefined}
    ${"2024-01-01"} | ${"2024-01-10"} | ${123}
    ${"2024-01-01"} | ${"2024-01-10"} | ${true}
    ${"2024-01-01"} | ${"2024-01-10"} | ${[]}
    ${"2024-01-01"} | ${"2024-01-10"} | ${{}}
  `(
    "returns null for non-string input: $start, $end, $unit",
    ({ start, end, unit }) => {
      expect(
        intervalCountDate(start as never, end as never, unit as never),
      ).toBeNull();
    },
  );

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(intervalCountDate("2024-01-01", "2024-01-10", "day")).toBeNull();
  });
  // E5 (issue #78): when start and end share a calendar tag, boundaries are counted in that
  // calendar -- a Hebrew leap year crosses 13 month boundaries and 1 year boundary, not 12/2.
  // Different calendars (a bare ISO string names iso8601) return null (TC39
  // CalendarEquals). Goldens verified directly against @js-temporal/polyfill.
  it("counts 13 month boundaries across a Hebrew leap year (not 12, ISO's answer for the same span)", () => {
    expect(
      intervalCountDate(
        "2023-09-16[u-ca=hebrew]",
        "2024-10-03[u-ca=hebrew]",
        "month",
      ),
    ).toBe(13);
  });

  it("counts 1 year boundary across a Hebrew leap year (not 2, ISO's answer for the same span)", () => {
    expect(
      intervalCountDate(
        "2023-09-16[u-ca=hebrew]",
        "2024-10-03[u-ca=hebrew]",
        "year",
      ),
    ).toBe(1);
  });

  // Indian National Calendar (Saka era) leap-year alignment follows the Gregorian rule rather
  // than an independent cycle, so its year boundary doesn't land on a fixed Gregorian
  // day-of-year -- verified directly against @js-temporal/polyfill:
  // convertDateToCalendar("2024-03-20", "indian") -> "2024-03-20[u-ca=indian]",
  // convertDateToCalendar("2024-03-21", "indian") -> "2024-03-21[u-ca=indian]".
  it("crosses an Indian-calendar year boundary that doesn't align to a fixed Gregorian date", () => {
    expect(
      intervalCountDate(
        "2024-03-19[u-ca=indian]", // 2024-03-19
        "2024-03-21[u-ca=indian]", // 2024-03-21
        "year",
      ),
    ).toBe(1);
  });

  // CORE-6 D1: the polyfill's calendar arithmetic throws within about a year of the maximum.
  // Hebrew 279517 is a leap year whose ordinal month 10 (Sivan) holds the maximum, day 11.
  it.each`
    start                           | end                             | unit       | expected | reason
    ${"+275760-07-06[u-ca=hebrew]"} | ${"+275760-09-13[u-ca=hebrew]"} | ${"month"} | ${3}     | ${"months 8, 9 and 10 up to the maximum"}
    ${"+275760-09-03[u-ca=hebrew]"} | ${"+275760-09-13[u-ca=hebrew]"} | ${"month"} | ${1}     | ${"the maximum's own month"}
    ${"+275758-12-23[u-ca=hebrew]"} | ${"+275760-09-13[u-ca=hebrew]"} | ${"year"}  | ${2}     | ${"years 279516 and 279517"}
    ${"1000-01-15[u-ca=buddhist]"}  | ${"1000-03-10[u-ca=buddhist]"}  | ${"month"} | ${3}     | ${"D2: buddhist months are ISO months (ISO 1000-01-15 to 1000-03-10); polyfill 0.5.1's with({ day: 1 }) lands on ISO 1000-01-06"}
  `(
    "counts $expected $unit boundaries from $start to $end ($reason)",
    ({ start, end, unit, expected }) => {
      expect(intervalCountDate(start, end, unit)).toBe(expected);
    },
  );

  // Native Temporal (Chromium 153) until throws "Mismatched calendars." for each pair.
  it.each`
    start                          | end                           | reason
    ${"2024-10-03[u-ca=hebrew]"}   | ${"2024-11-03"}               | ${"hebrew and bare ISO"}
    ${"2024-10-03"}                | ${"2024-11-02[u-ca=gregory]"} | ${"iso8601 and gregory"}
    ${"2024-10-03[u-ca=ethiopic]"} | ${"2024-11-02[u-ca=ethioaa]"} | ${"ethiopic and ethioaa"}
  `(
    "returns null from $start to $end ($reason: different calendars)",
    ({ start, end }) => {
      expect(intervalCountDate(start, end, "month")).toBeNull();
      expect(intervalCountDate(start, end, "day")).toBeNull();
    },
  );
});
