import { calendarZonedFixtures } from "../../test";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { diffZoned } from "./diffZoned";

describe("diffZonedDateTime", () => {
  it.each`
    value1                                  | value2                                  | unit              | expected
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2029-01-01T00:00:00+00:00[UTC]"}     | ${"years"}        | ${1}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-02-01T00:00:00+00:00[UTC]"}     | ${"months"}       | ${1}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-08T00:00:00+00:00[UTC]"}     | ${"weeks"}        | ${1}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-02T00:00:00+00:00[UTC]"}     | ${"days"}         | ${1}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-01T01:00:00+00:00[UTC]"}     | ${"hours"}        | ${1}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-01T00:01:00+00:00[UTC]"}     | ${"minutes"}      | ${1}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-01T00:00:01+00:00[UTC]"}     | ${"seconds"}      | ${1}
    ${"2028-01-01T00:00:00.000+00:00[UTC]"} | ${"2028-01-01T00:00:00.001+00:00[UTC]"} | ${"milliseconds"} | ${1}
  `(
    "returns int $expected for single unit difference between $value1 and $value2 for unit $unit",
    ({ value1, value2, unit, expected }) => {
      expect(diffZoned(value1, value2, unit)).toEqual(expected);
    },
  );

  it.each`
    value1                                  | value2                                  | units                  | expected
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2029-01-01T00:00:00+00:00[UTC]"}     | ${["years"]}           | ${{ years: 1 }}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-02-01T00:00:00+00:00[UTC]"}     | ${["months"]}          | ${{ months: 1 }}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-08T00:00:00+00:00[UTC]"}     | ${["weeks"]}           | ${{ weeks: 1 }}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-02T00:00:00+00:00[UTC]"}     | ${["days"]}            | ${{ days: 1 }}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-01T01:00:00+00:00[UTC]"}     | ${["hours"]}           | ${{ hours: 1 }}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-01T00:01:00+00:00[UTC]"}     | ${["minutes"]}         | ${{ minutes: 1 }}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-01T00:00:01+00:00[UTC]"}     | ${["seconds"]}         | ${{ seconds: 1 }}
    ${"2028-01-01T00:00:00.000+00:00[UTC]"} | ${"2028-01-01T00:00:00.001+00:00[UTC]"} | ${["milliseconds"]}    | ${{ milliseconds: 1 }}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2029-01-01T00:00:00+00:00[UTC]"}     | ${["years", "months"]} | ${{ years: 1, months: 0 }}
  `(
    "returns $expected for $units difference between $value1 and $value2",
    ({ value1, value2, units, expected }) => {
      expect(diffZoned(value1, value2, units)).toEqual(expected);
    },
  );

  it.each`
    value1                                       | value2
    ${"2028-01-01T00:00:00+00:00[UTC]"}          | ${"2028-01-02T00:00:00+00:00[UTC]"}
    ${"2028-01-01T00:00:00+00:00[UTC]"}          | ${"2028-01-02T13:00:00+13:00[Pacific/Apia]"}
    ${"2028-01-01T13:00:00+13:00[Pacific/Apia]"} | ${"2028-01-02T00:00:00+00:00[UTC]"}
    ${"2028-01-01T00:00:00+00:00[UTC]"}          | ${"2028-01-01T13:00:00-11:00[Pacific/Niue]"}
    ${"2027-12-31T13:00:00-11:00[Pacific/Niue]"} | ${"2028-01-02T00:00:00+00:00[UTC]"}
    ${"2028-01-01T13:00:00+13:00[Pacific/Apia]"} | ${"2028-01-01T13:00:00-11:00[Pacific/Niue]"}
    ${"2027-12-31T13:00:00-11:00[Pacific/Niue]"} | ${"2028-01-02T13:00:00+13:00[Pacific/Apia]"}
  `(
    "supports multi timeZone diffs for $value1 and $value2, expecting 1 day difference",
    ({ value1, value2 }) => {
      expect(diffZoned(value1, value2, ["days"])).toEqual({ days: 1 });
    },
  );

  // Leap-year coverage: ensure day-based diffs account for Feb 29.
  it.each`
    value1                              | value2                              | units        | expected
    ${"2024-02-28T00:00:00+00:00[UTC]"} | ${"2024-03-01T00:00:00+00:00[UTC]"} | ${["days"]}  | ${{ days: 2 }}
    ${"2023-02-28T00:00:00+00:00[UTC]"} | ${"2023-03-01T00:00:00+00:00[UTC]"} | ${["days"]}  | ${{ days: 1 }}
    ${"2020-02-29T00:00:00+00:00[UTC]"} | ${"2021-03-01T00:00:00+00:00[UTC]"} | ${["years"]} | ${{ years: 1 }}
  `(
    "handles leap-year boundaries for $value1 -> $value2",
    ({ value1, value2, units, expected }) => {
      expect(diffZoned(value1, value2, units)).toEqual(expected);
    },
  );

  // Error and invalid-input cases: return null when inputs or units are invalid
  it.each`
    value1                              | value2                              | units
    ${"invalid"}                        | ${"2024-03-01T00:00:00+00:00[UTC]"} | ${["days"]}
    ${"2024-03-01T00:00:00+00:00[UTC]"} | ${"invalid"}                        | ${["days"]}
    ${""}                               | ${"2024-03-01T00:00:00+00:00[UTC]"} | ${["days"]}
    ${null}                             | ${"2024-03-01T00:00:00+00:00[UTC]"} | ${["days"]}
  `(
    "returns null for invalid inputs: $value1 | $value2 | $units",
    ({ value1, value2, units }) => {
      expect(diffZoned(value1 as never, value2 as never, units as never)).toBe(
        null,
      );
    },
  );

  it.each`
    roundingMode    | expected
    ${"ceil"}       | ${2}
    ${"floor"}      | ${1}
    ${"trunc"}      | ${1}
    ${"halfExpand"} | ${2}
  `(
    "rounds a 90-minute span to $expected hours with smallestUnit hour, roundingMode $roundingMode",
    ({ roundingMode, expected }) => {
      expect(
        diffZoned(
          "2028-01-01T00:00:00+00:00[UTC]",
          "2028-01-01T01:30:00+00:00[UTC]",
          "hours",
          { smallestUnit: "hours", roundingMode },
        ),
      ).toBe(expected);
    },
  );

  it("returns the unrounded result when no rounding options are provided", () => {
    expect(
      diffZoned(
        "2028-01-01T00:00:00+00:00[UTC]",
        "2028-01-01T01:40:00+00:00[UTC]",
        "minutes",
      ),
    ).toBe(100);
  });

  it.each`
    value1                                       | value2                                       | timeZone
    ${"2028-01-01T00:00:00+00:00[UTC]"}          | ${"2028-01-01T01:30:00+00:00[UTC]"}          | ${"UTC"}
    ${"2028-01-01T13:00:00+13:00[Pacific/Apia]"} | ${"2028-01-01T14:30:00+13:00[Pacific/Apia]"} | ${"Pacific/Apia"}
    ${"2027-12-31T13:00:00-11:00[Pacific/Niue]"} | ${"2027-12-31T14:30:00-11:00[Pacific/Niue]"} | ${"Pacific/Niue"}
  `(
    "rounds the same 90-minute instant span to 2 hours regardless of timeZone $timeZone (UTC-normalized before rounding)",
    ({ value1, value2 }) => {
      expect(
        diffZoned(value1, value2, "hours", {
          smallestUnit: "hours",
          roundingMode: "halfExpand",
        }),
      ).toBe(2);
    },
  );

  it("rounds a span crossing the America/New_York spring-forward DST gap to the real 47-hour elapsed time (not the naive 48 calendar hours)", () => {
    // 2024-03-09T12:00 to 2024-03-11T12:00 spans 2 calendar days, but the clocks jump forward
    // 1 hour on 2024-03-10, so only 47 real hours actually elapse.
    expect(
      diffZoned(
        "2024-03-09T12:00:00-05:00[America/New_York]",
        "2024-03-11T12:00:00-04:00[America/New_York]",
        "hours",
      ),
    ).toBe(47);
  });

  it("rounds that same DST-crossing span to 2 days with smallestUnit day", () => {
    expect(
      diffZoned(
        "2024-03-09T12:00:00-05:00[America/New_York]",
        "2024-03-11T12:00:00-04:00[America/New_York]",
        "days",
        { smallestUnit: "days", roundingMode: "halfExpand" },
      ),
    ).toBe(2);
  });

  it("returns null when roundingIncrement does not evenly divide the unit (minutes must divide 60)", () => {
    expect(
      diffZoned(
        "2028-01-01T00:00:00+00:00[UTC]",
        "2028-01-01T01:30:00+00:00[UTC]",
        "minutes",
        {
          smallestUnit: "minutes",
          roundingIncrement: 7,
          roundingMode: "trunc",
        },
      ),
    ).toBeNull();
  });

  it("rounds a negative diff (value1 after value2)", () => {
    expect(
      diffZoned(
        "2028-01-01T01:30:00+00:00[UTC]",
        "2028-01-01T00:00:00+00:00[UTC]",
        "hours",
        { smallestUnit: "hours", roundingMode: "halfExpand" },
      ),
    ).toBe(-2);
  });

  it("rounds a result requested as an array of units", () => {
    expect(
      diffZoned(
        "2028-01-01T00:00:00+00:00[UTC]",
        "2028-01-01T01:45:00+00:00[UTC]",
        ["hours", "minutes"],
        {
          smallestUnit: "minutes",
          roundingIncrement: 30,
          roundingMode: "halfExpand",
        },
      ),
    ).toEqual({ hours: 2, minutes: 0 });
  });

  it("returns the unrounded array-of-units result when no options are provided", () => {
    expect(
      diffZoned(
        "2028-01-01T00:00:00+00:00[UTC]",
        "2028-01-01T01:45:00+00:00[UTC]",
        ["hours", "minutes"],
      ),
    ).toEqual({ hours: 1, minutes: 45 });
  });

  it("returns null when smallestUnit is coarser than the largest requested unit", () => {
    expect(
      diffZoned(
        "2028-01-01T00:00:00+00:00[UTC]",
        "2028-01-01T01:45:00+00:00[UTC]",
        ["minutes", "seconds"],
        { smallestUnit: "hours" },
      ),
    ).toBeNull();
  });
  // E5 (issue #78), decision of record D2 -- see addZoned.test.ts for the full rationale.
  it("returns null when value1 carries a calendar annotation", () => {
    expect(
      diffZoned(
        "2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]",
        "2024-06-30T23:59:59+00:00[UTC]",
        "months",
      ),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// E7 (issue #152), D5-zoned — measure in the endpoints' shared calendar, fall back to
// Gregorian/ISO on mismatch or bare input. Every expected value produced by running
// @js-temporal/polyfill@0.5.1.
// ---------------------------------------------------------------------------------------------
describe("diffZoned with GMT calendar-annotated values", () => {
  const Y = calendarZonedFixtures.hebrewLeapYearSpan;
  const ISLAMIC_END =
    "1446-03-30T00:00:00-04:00[u-ca=islamic-tabular][America/New_York]";

  it("measures a Hebrew leap year as 13 months where the ISO control measures 12", () => {
    expect(
      diffZoned(Y.tishri1_5784NewYork, Y.tishri1_5785NewYork, "months"),
    ).toBe(13);
    expect(diffZoned(Y.isoStart, Y.isoEnd, "months")).toBe(12);
  });

  // The fallback is what makes a purely time-unit question answerable across calendars at all:
  // ZonedDateTime.until throws for EVERY largestUnit when the calendars differ.
  it("falls back to Gregorian for mismatched tags instead of returning null", () => {
    expect(diffZoned(Y.tishri1_5784NewYork, ISLAMIC_END, "hours")).toBe(9192);
    expect(diffZoned(Y.isoStart, Y.isoEnd, "hours")).toBe(9192);
  });

  it.each`
    label                       | start                    | end                      | expected
    ${"mismatched tags"}        | ${Y.tishri1_5784NewYork} | ${ISLAMIC_END}           | ${12}
    ${"tagged start, bare end"} | ${Y.tishri1_5784NewYork} | ${Y.isoEnd}              | ${12}
    ${"both bare"}              | ${Y.isoStart}            | ${Y.isoEnd}              | ${12}
    ${"both hebrew"}            | ${Y.tishri1_5784NewYork} | ${Y.tishri1_5785NewYork} | ${13}
  `("returns $expected months for $label", ({ start, end, expected }) => {
    expect(diffZoned(start, end, "months")).toBe(expected);
  });

  it.each`
    value                                                         | reason
    ${"5784-01-01T00:00:00-04:00[America/New_York][u-ca=hebrew]"} | ${"GMT digits in Temporal's segment ordering"}
    ${"5785-13-15T14:30:00-05:00[u-ca=hebrew][America/New_York]"} | ${"month 13 in a non-leap Hebrew year"}
  `("returns null when the start is $value ($reason)", ({ value }) => {
    expect(diffZoned(value, Y.isoEnd, "days")).toBeNull();
  });

  it("returns null when Temporal.ZonedDateTime.from throws for a calendar-tagged pair", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      diffZoned(Y.tishri1_5784NewYork, Y.tishri1_5785NewYork, "months"),
    ).toBeNull();
  });
});
