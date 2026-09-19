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

  // Temporal DifferenceTemporalZonedDateTime: a calendar largestUnit (days and larger) across two
  // different time zones throws ("day lengths can vary between time zones") -> null; time units are
  // exact time, so every pair below is 24 hours apart.
  it.each`
    value1                                           | value2                                       | units                 | expected
    ${"2028-01-01T00:00:00+00:00[UTC]"}              | ${"2028-01-02T00:00:00+00:00[UTC]"}          | ${["days"]}           | ${{ days: 1 }}
    ${"2028-01-01T00:00:00+00:00[UTC]"}              | ${"2028-01-02T13:00:00+13:00[Pacific/Apia]"} | ${["days"]}           | ${null}
    ${"2028-01-01T00:00:00+00:00[UTC]"}              | ${"2028-01-02T13:00:00+13:00[Pacific/Apia]"} | ${["hours"]}          | ${{ hours: 24 }}
    ${"2028-01-01T13:00:00+13:00[Pacific/Apia]"}     | ${"2028-01-02T00:00:00+00:00[UTC]"}          | ${["days"]}           | ${null}
    ${"2028-01-01T13:00:00+13:00[Pacific/Apia]"}     | ${"2028-01-02T00:00:00+00:00[UTC]"}          | ${["hours"]}          | ${{ hours: 24 }}
    ${"2028-01-01T00:00:00+00:00[UTC]"}              | ${"2028-01-01T13:00:00-11:00[Pacific/Niue]"} | ${["weeks"]}          | ${null}
    ${"2027-12-31T13:00:00-11:00[Pacific/Niue]"}     | ${"2028-01-02T00:00:00+00:00[UTC]"}          | ${["minutes"]}        | ${{ minutes: 1440 }}
    ${"2028-01-01T13:00:00+13:00[Pacific/Apia]"}     | ${"2028-01-01T13:00:00-11:00[Pacific/Niue]"} | ${["months"]}         | ${null}
    ${"2027-12-31T13:00:00-11:00[Pacific/Niue]"}     | ${"2028-01-02T13:00:00+13:00[Pacific/Apia]"} | ${["years", "hours"]} | ${null}
    ${"2027-12-31T13:00:00-11:00[Pacific/Niue]"}     | ${"2028-01-02T13:00:00+13:00[Pacific/Apia]"} | ${["hours"]}          | ${{ hours: 24 }}
    ${"2024-01-01T00:00:00-05:00[America/New_York]"} | ${"2024-01-03T00:00:00+01:00[Europe/Paris]"} | ${"days"}             | ${null}
    ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2024-01-03T00:00:00+00:00[Etc/UTC]"}      | ${"days"}             | ${2}
    ${"2024-01-01T00:00:00+05:30[Asia/Calcutta]"}    | ${"2024-01-03T00:00:00+05:30[Asia/Kolkata]"} | ${"days"}             | ${2}
  `(
    "returns $expected for $units from $value1 to $value2 (calendar units need one time zone)",
    ({ value1, value2, units, expected }) => {
      expect(diffZoned(value1, value2, units)).toEqual(expected);
    },
  );

  // Temporal §6.5.6 DifferenceZonedDateTime: calendar units are measured on the zone's own wall
  // clock, so a DST day still counts as one day and a month from the 31st follows the local date.
  it.each`
    value1                                           | value2                                           | units                 | expected
    ${"2024-03-09T12:00:00-05:00[America/New_York]"} | ${"2024-03-10T12:00:00-04:00[America/New_York]"} | ${"days"}             | ${1}
    ${"2024-03-09T12:00:00-05:00[America/New_York]"} | ${"2024-03-11T12:00:00-04:00[America/New_York]"} | ${"days"}             | ${2}
    ${"2024-01-31T23:30:00-05:00[America/New_York]"} | ${"2024-02-29T23:30:00-05:00[America/New_York]"} | ${["months", "days"]} | ${{ months: 0, days: 29 }}
  `(
    "returns $expected for $units from $value1 to $value2 on the local wall clock",
    ({ value1, value2, units, expected }) => {
      expect(diffZoned(value1, value2, units)).toEqual(expected);
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
    "rounds the same 90-minute instant span to 2 hours regardless of timeZone $timeZone (exact time before rounding)",
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

  it("counts that same DST-crossing span as 2 days without any rounding (wall-clock days)", () => {
    expect(
      diffZoned(
        "2024-03-09T12:00:00-05:00[America/New_York]",
        "2024-03-11T12:00:00-04:00[America/New_York]",
        "days",
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
  // Temporal's own RFC 9557 string is GMT's calendar grammar. The two endpoints name
  // different calendars (hebrew, iso8601), so the result is null, as native Temporal (Chromium
  // 153) until throws "Mismatched calendars." (TC39 DifferenceTemporalZonedDateTime).
  it("returns null for a calendar-annotated string against a bare one (different calendars)", () => {
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
// E7 (issue #152) — measure in the endpoints' shared calendar. Different calendars (a
// bare string names iso8601) return null, as TC39 DifferenceTemporalZonedDateTime throws for
// every largestUnit (native Chromium 153: "Mismatched calendars." in hours and months).
// ---------------------------------------------------------------------------------------------
describe("diffZoned with RFC 9557 calendar-annotated values", () => {
  const Y = calendarZonedFixtures.hebrewLeapYearSpan;
  const ISLAMIC_END =
    "2024-10-03T00:00:00-04:00[America/New_York][u-ca=islamic-tbla]";

  it("measures a Hebrew leap year as 13 months where the ISO control measures 12", () => {
    expect(
      diffZoned(Y.tishri1_5784NewYork, Y.tishri1_5785NewYork, "months"),
    ).toBe(13);
    expect(diffZoned(Y.isoStart, Y.isoEnd, "months")).toBe(12);
  });

  // ZonedDateTime.until throws for EVERY largestUnit when the calendars differ, hours included.
  it("returns null for mismatched tags even in hours", () => {
    expect(diffZoned(Y.tishri1_5784NewYork, ISLAMIC_END, "hours")).toBeNull();
    expect(diffZoned(Y.isoStart, Y.isoEnd, "hours")).toBe(9192);
  });

  it.each`
    label                       | start                    | end                      | expected
    ${"mismatched tags"}        | ${Y.tishri1_5784NewYork} | ${ISLAMIC_END}           | ${null}
    ${"tagged start, bare end"} | ${Y.tishri1_5784NewYork} | ${Y.isoEnd}              | ${null}
    ${"both bare"}              | ${Y.isoStart}            | ${Y.isoEnd}              | ${12}
    ${"both hebrew"}            | ${Y.tishri1_5784NewYork} | ${Y.tishri1_5785NewYork} | ${13}
  `("returns $expected months for $label", ({ start, end, expected }) => {
    expect(diffZoned(start, end, "months")).toBe(expected);
  });

  it.each`
    value                                                         | reason
    ${"5784-01-01T00:00:00-04:00[America/New_York][u-ca=hebrew]"} | ${"-04:00 is not New York's offset on ISO 5784-01-01 (EST)"}
    ${"2023-09-16T00:00:00-04:00[u-ca=hebrew][America/New_York]"} | ${"calendar before zone (not RFC 9557)"}
    ${"2024-13-15T14:30:00-05:00[America/New_York][u-ca=hebrew]"} | ${"ISO month 13 (the digits are ISO)"}
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

describe("diffZoned at the maximum instant", () => {
  // diffZoned measures in UTC. From max - 3d5h to max, TC39 NudgeToZonedTime rounds P3DT5H to an
  // hour by resolving +275760-09-13T19:00 in UTC, 19 hours past the maximum, which
  // GetPossibleEpochNanoseconds rejects, so Temporal throws whatever zone the operands carry.
  it.each`
    value1                                              | value2
    ${"+275760-09-09T19:00:00+00:00[UTC]"}              | ${"+275760-09-13T00:00:00+00:00[UTC]"}
    ${"+275760-09-09T19:00:00+00:00[+00:00]"}           | ${"+275760-09-13T00:00:00+00:00[+00:00]"}
    ${"+275760-09-09T20:00:00+01:00[Europe/London]"}    | ${"+275760-09-13T01:00:00+01:00[Europe/London]"}
    ${"+275760-09-10T05:00:00+10:00[Australia/Sydney]"} | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}
  `(
    "returns null rounding days to an hour from $value1 to $value2",
    ({ value1, value2 }) => {
      expect(
        diffZoned(value1, value2, "days", { smallestUnit: "hour" }),
      ).toBeNull();
    },
  );

  it("returns 5 rounding days to an hour from max - 10d5h to max - 5d", () => {
    expect(
      diffZoned(
        "+275760-09-02T19:00:00+00:00[UTC]",
        "+275760-09-08T00:00:00+00:00[UTC]",
        "days",
        { smallestUnit: "hour" },
      ),
    ).toBe(5);
  });
});

describe("diffZoned at the minimum instant", () => {
  // diffZoned measures in UTC. From min + 2d5h back to min (-271821-04-20T00:00Z), TC39
  // DifferenceZonedDateTime gives -P2DT5H and NudgeToZonedTime resolves the end of the day window,
  // -271821-04-19T05:00 in UTC, 19 hours before the minimum, which GetPossibleEpochNanoseconds
  // rejects in UTC as in +00:00. Five days later the window stays in range: -P2DT5H, -2 days.
  it.each`
    value1                                    | value2                                    | expected
    ${"-271821-04-22T05:00:00+00:00[UTC]"}    | ${"-271821-04-20T00:00:00+00:00[UTC]"}    | ${null}
    ${"-271821-04-22T05:00:00+00:00[+00:00]"} | ${"-271821-04-20T00:00:00+00:00[+00:00]"} | ${null}
    ${"-271821-04-27T05:00:00+00:00[UTC]"}    | ${"-271821-04-25T00:00:00+00:00[UTC]"}    | ${-2}
  `(
    "returns $expected rounding days to an hour from $value1 back to $value2",
    ({ value1, value2, expected }) => {
      expect(diffZoned(value1, value2, "days", { smallestUnit: "hour" })).toBe(
        expected,
      );
    },
  );
});

// CORE-6 S5: whole calendar units in a zoned difference follow NonISODateUntil. Chromium 153 gives
// P30D for the buddhist month end and P12M29D for the Hebrew Adar I 2 -> Adar 1 span, so neither
// reaches one whole unit.
describe("diffZoned in non-ISO calendars (CORE-6)", () => {
  it.each`
    start                                                           | end                                                             | unit        | expected | reason
    ${"2023-08-31T00:00:00+00:00[UTC][u-ca=buddhist]"}              | ${"2023-09-30T00:00:00+00:00[UTC][u-ca=buddhist]"}              | ${"months"} | ${0}     | ${"D6: P30D is no whole month"}
    ${"2023-08-31T00:00:00-04:00[America/New_York][u-ca=buddhist]"} | ${"2023-09-30T00:00:00-04:00[America/New_York][u-ca=buddhist]"} | ${"months"} | ${0}     | ${"D6 in a named zone"}
    ${"2024-02-11T00:00:00-05:00[America/New_York][u-ca=hebrew]"}   | ${"2025-03-01T00:00:00-05:00[America/New_York][u-ca=hebrew]"}   | ${"years"}  | ${0}     | ${"D7: P12M29D is no whole year"}
  `(
    "returns $expected $unit from $start to $end ($reason)",
    ({ start, end, unit, expected }) => {
      expect(diffZoned(start, end, unit)).toBe(expected);
    },
  );

  // An empty units list names no largest unit (getLargestDateTimeDurationUnit returns ""), so there
  // is nothing to measure: invalid input.
  it("returns null for an empty units list", () => {
    expect(
      diffZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-08T00:00:00+00:00[UTC]",
        [],
      ),
    ).toBeNull();
  });
});

// Plan #16: a units array returns the whole difference; unlisted units between listed ones are
// carried into the next smaller listed unit, from the start moved by the larger listed amounts on
// the zone's wall clock. Values from native Temporal (Chromium 153):
// - UTC 2024-01-01 until 2025-03-01 is P1Y2M; 2025-01-01 to 2025-03-01 is 59 days.
// - New York 2024-02-09T12:00-05:00 until 2024-03-11T12:00-04:00 is P1M2D; + P1M is
//   2024-03-09T12:00-05:00, which is 47 hours before the end (2024-03-10 is a 23-hour day).
// - New York 2024-01-01T00:00-05:00 until 2024-03-20T00:00-04:00 is P2M19D; Temporal fills weeks
//   only for largestUnit weeks, and 2024-03-01 until 2024-03-20 is P2W5D, the 5 days (after the
//   23-hour 2024-03-10) being 120 hours.
describe("diffZoned units array carries unlisted units", () => {
  it.each`
    value1                                           | value2                                           | units                           | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"}              | ${"2025-03-01T00:00:00+00:00[UTC]"}              | ${["years", "days"]}            | ${{ years: 1, days: 59 }}
    ${"2024-02-09T12:00:00-05:00[America/New_York]"} | ${"2024-03-11T12:00:00-04:00[America/New_York]"} | ${["months", "hours"]}          | ${{ months: 1, hours: 47 }}
    ${"2024-03-11T12:00:00-04:00[America/New_York]"} | ${"2024-02-09T12:00:00-05:00[America/New_York]"} | ${["months", "days"]}           | ${{ months: -1, days: -2 }}
    ${"2024-01-01T00:00:00-05:00[America/New_York]"} | ${"2024-03-20T00:00:00-04:00[America/New_York]"} | ${["months", "weeks", "hours"]} | ${{ months: 2, weeks: 2, hours: 120 }}
  `(
    "returns $expected for $units from $value1 to $value2",
    ({ value1, value2, units, expected }) => {
      expect(diffZoned(value1, value2, units)).toEqual(expected);
    },
  );
});

// Temporal GetOptionsObject: an options argument that is not an object or undefined throws
// TypeError (native Chromium 153: `until(other, null)`, `"x"`, `5` and `true` all throw), so each is
// invalid input. Omitted options measure normally (PT49H).
describe("diffZoned with a non-object options argument", () => {
  it.each`
    options      | expected
    ${null}      | ${null}
    ${"x"}       | ${null}
    ${5}         | ${null}
    ${true}      | ${null}
    ${undefined} | ${49}
  `("returns $expected for options $options", ({ options, expected }) => {
    expect(
      diffZoned(
        "2024-02-28T14:30:00+00:00[UTC]",
        "2024-03-01T15:30:00+00:00[UTC]",
        "hours",
        options,
      ),
    ).toBe(expected);
  });
});

// Temporal §13.17: singular and plural unit names are the same unit, and record keys are the plural
// names. Native Chromium 153: 2024-02-28T14:30:00+00:00[UTC] until 2024-03-01T15:30:00+00:00[UTC] with largestUnit "day" is P2DT1H.
describe("diffZoned with singular unit names", () => {
  it.each`
    units              | expected
    ${"day"}           | ${2}
    ${"days"}          | ${2}
    ${"hour"}          | ${49}
    ${["day", "hour"]} | ${{ days: 2, hours: 1 }}
  `("returns $expected for units $units", ({ units, expected }) => {
    expect(
      diffZoned(
        "2024-02-28T14:30:00+00:00[UTC]",
        "2024-03-01T15:30:00+00:00[UTC]",
        units,
      ),
    ).toEqual(expected);
  });
});
