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
    "returns $expected $unit boundaries for $start..$end",
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
    "returns $expected for $start..$end with plural unit $unit",
    ({ start, end, unit, expected }) => {
      expect(intervalCountDate(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start           | end             | unit       | expected
    ${"2024-01-01"} | ${"2024-01-01"} | ${"day"}   | ${0}
    ${"2024-01-15"} | ${"2024-01-15"} | ${"day"}   | ${0}
    ${"2024-01-15"} | ${"2024-01-15"} | ${"month"} | ${1}
    ${"2024-01-04"} | ${"2024-01-04"} | ${"week"}  | ${1}
    ${"2024-06-15"} | ${"2024-06-15"} | ${"year"}  | ${1}
    ${"2024-01-01"} | ${"2024-01-01"} | ${"month"} | ${0}
    ${"2024-01-01"} | ${"2024-01-01"} | ${"year"}  | ${0}
  `(
    "returns $expected for zero-length $start..$end counted in $unit",
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
    "returns $expected for boundary case $start..$end counted in $unit",
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
  // calendar (E5 decision of record D5) -- a Hebrew leap year crosses 13 month boundaries and
  // 1 year boundary, not 12/2. A mismatch (or bare ISO) falls back to Gregorian. Goldens
  // verified directly against @js-temporal/polyfill.
  it("counts 13 month boundaries across a Hebrew leap year (not 12, ISO's answer for the same span)", () => {
    expect(
      intervalCountDate(
        "5784-01-01[u-ca=hebrew]",
        "5785-01-01[u-ca=hebrew]",
        "month",
      ),
    ).toBe(13);
  });

  it("counts 1 year boundary across a Hebrew leap year (not 2, ISO's answer for the same span)", () => {
    expect(
      intervalCountDate(
        "5784-01-01[u-ca=hebrew]",
        "5785-01-01[u-ca=hebrew]",
        "year",
      ),
    ).toBe(1);
  });

  // Indian National Calendar (Saka era) leap-year alignment follows the Gregorian rule rather
  // than an independent cycle, so its year boundary doesn't land on a fixed Gregorian
  // day-of-year -- verified directly against @js-temporal/polyfill:
  // convertDateToCalendar("2024-03-20", "indian") -> "1945-12-30[u-ca=indian]",
  // convertDateToCalendar("2024-03-21", "indian") -> "1946-01-01[u-ca=indian]".
  it("crosses an Indian-calendar year boundary that doesn't align to a fixed Gregorian date", () => {
    expect(
      intervalCountDate(
        "1945-12-29[u-ca=indian]", // 2024-03-19
        "1946-01-01[u-ca=indian]", // 2024-03-21
        "year",
      ),
    ).toBe(1);
  });

  it("falls back to Gregorian when start and end carry mismatched calendars", () => {
    // 5785-01-01 hebrew = 2024-10-03 (verified); crosses the Nov 1 boundary -> 2 months.
    expect(
      intervalCountDate("5785-01-01[u-ca=hebrew]", "2024-11-03", "month"),
    ).toBe(2);
  });
});
