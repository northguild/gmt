import { calendarZonedFixtures } from "../../test";
import { Temporal } from "@js-temporal/polyfill";
import { localNoonBattleCases } from "../../test";
import { diffZonedAsDuration } from "./diffZonedAsDuration";

describe("diffZonedAsDuration", () => {
  for (const { timeZone, value } of localNoonBattleCases) {
    it(`returns PT1H for a 1-hour span at local noon across battle-test timeZone ${timeZone}`, () => {
      const end = Temporal.ZonedDateTime.from(value)
        .add({ hours: 1 })
        .toString();
      expect(diffZonedAsDuration(value, end, "hours")).toBe("PT1H");
    });
  }

  it.each`
    value1                              | value2                              | unit         | expected
    ${"2028-01-01T00:00:00+00:00[UTC]"} | ${"2029-01-01T00:00:00+00:00[UTC]"} | ${"years"}   | ${"P1Y"}
    ${"2028-01-01T00:00:00+00:00[UTC]"} | ${"2028-02-01T00:00:00+00:00[UTC]"} | ${"months"}  | ${"P1M"}
    ${"2028-01-01T00:00:00+00:00[UTC]"} | ${"2028-01-08T00:00:00+00:00[UTC]"} | ${"weeks"}   | ${"P1W"}
    ${"2028-01-01T00:00:00+00:00[UTC]"} | ${"2028-01-02T00:00:00+00:00[UTC]"} | ${"days"}    | ${"P1D"}
    ${"2028-01-01T00:00:00+00:00[UTC]"} | ${"2028-01-01T01:00:00+00:00[UTC]"} | ${"hours"}   | ${"PT1H"}
    ${"2028-01-01T00:00:00+00:00[UTC]"} | ${"2028-01-01T00:01:00+00:00[UTC]"} | ${"minutes"} | ${"PT1M"}
  `(
    "returns $expected for single $unit comparing $value1, $value2",
    ({ value1, value2, unit, expected }) => {
      expect(diffZonedAsDuration(value1, value2, unit)).toBe(expected);
    },
  );

  // Temporal DifferenceTemporalZonedDateTime: a calendar largestUnit across two time zones throws.
  it.each`
    value1                              | value2                                       | unit        | expected
    ${"2028-01-01T00:00:00+00:00[UTC]"} | ${"2028-01-02T13:00:00+13:00[Pacific/Apia]"} | ${"days"}   | ${""}
    ${"2028-01-01T00:00:00+00:00[UTC]"} | ${"2028-01-02T13:00:00+13:00[Pacific/Apia]"} | ${"months"} | ${""}
    ${"2028-01-01T00:00:00+00:00[UTC]"} | ${"2028-01-02T13:00:00+13:00[Pacific/Apia]"} | ${"hours"}  | ${"PT24H"}
  `(
    "returns $expected for $unit from $value1 to $value2 across time zones",
    ({ value1, value2, unit, expected }) => {
      expect(diffZonedAsDuration(value1, value2, unit)).toBe(expected);
    },
  );

  // Temporal §6.5.6 DifferenceZonedDateTime: calendar units on the zone's wall clock.
  it.each`
    value1                                           | value2                                           | unit        | expected
    ${"2024-03-09T12:00:00-05:00[America/New_York]"} | ${"2024-03-10T12:00:00-04:00[America/New_York]"} | ${"days"}   | ${"P1D"}
    ${"2024-01-31T23:30:00-05:00[America/New_York]"} | ${"2024-02-29T23:30:00-05:00[America/New_York]"} | ${"months"} | ${"P29D"}
  `(
    "returns $expected for $unit from $value1 to $value2 on the local wall clock",
    ({ value1, value2, unit, expected }) => {
      expect(diffZonedAsDuration(value1, value2, unit)).toBe(expected);
    },
  );

  it("rounds a span crossing the America/New_York spring-forward DST gap to the real 47-hour elapsed time", () => {
    expect(
      diffZonedAsDuration(
        "2024-03-09T12:00:00-05:00[America/New_York]",
        "2024-03-11T12:00:00-04:00[America/New_York]",
        "days",
      ),
    ).toBe("P2D");
    expect(
      diffZonedAsDuration(
        "2024-03-09T12:00:00-05:00[America/New_York]",
        "2024-03-11T12:00:00-04:00[America/New_York]",
        "hours",
      ),
    ).toBe("PT47H");
  });

  it("returns negative duration for value1 after value2", () => {
    expect(
      diffZonedAsDuration(
        "2028-01-01T01:30:00+00:00[UTC]",
        "2028-01-01T00:00:00+00:00[UTC]",
        "hours",
      ),
    ).toBe("-PT1H30M");
  });

  it("returns PT0S for a zero-length diff", () => {
    expect(
      diffZonedAsDuration(
        "2028-01-01T00:00:00+00:00[UTC]",
        "2028-01-01T00:00:00+00:00[UTC]",
        "hours",
      ),
    ).toBe("PT0S");
  });

  it.each`
    value1                              | value2                              | unit
    ${"invalid"}                        | ${"2024-03-01T00:00:00+00:00[UTC]"} | ${"days"}
    ${"2024-03-01T00:00:00+00:00[UTC]"} | ${"invalid"}                        | ${"days"}
    ${""}                               | ${"2024-03-01T00:00:00+00:00[UTC]"} | ${"days"}
    ${null}                             | ${"2024-03-01T00:00:00+00:00[UTC]"} | ${"days"}
    ${"2024-03-01T00:00:00+00:00[UTC]"} | ${"2024-03-02T00:00:00+00:00[UTC]"} | ${"invalid"}
    ${"2024-03-01T00:00:00+00:00[UTC]"} | ${"2024-03-02T00:00:00+00:00[UTC]"} | ${["days"]}
  `(
    'returns "" for invalid inputs: $value1 | $value2 | $unit',
    ({ value1, value2, unit }) => {
      expect(
        diffZonedAsDuration(value1 as never, value2 as never, unit as never),
      ).toBe("");
    },
  );

  it.each`
    roundingMode    | expected
    ${"ceil"}       | ${"PT2H"}
    ${"floor"}      | ${"PT1H"}
    ${"trunc"}      | ${"PT1H"}
    ${"halfExpand"} | ${"PT2H"}
  `(
    "rounds a 90-minute span to $expected with smallestUnit hour, roundingMode $roundingMode",
    ({ roundingMode, expected }) => {
      expect(
        diffZonedAsDuration(
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
      diffZonedAsDuration(
        "2028-01-01T00:00:00+00:00[UTC]",
        "2028-01-01T01:40:00+00:00[UTC]",
        "minutes",
      ),
    ).toBe("PT100M");
  });

  it("rounds the same 90-minute instant span to 2 hours regardless of timeZone (exact time before rounding)", () => {
    expect(
      diffZonedAsDuration(
        "2028-01-01T13:00:00+13:00[Pacific/Apia]",
        "2028-01-01T14:30:00+13:00[Pacific/Apia]",
        "hours",
        { smallestUnit: "hours", roundingMode: "halfExpand" },
      ),
    ).toBe("PT2H");
  });

  it('returns "" when roundingIncrement does not evenly divide the unit', () => {
    expect(
      diffZonedAsDuration(
        "2028-01-01T00:00:00+00:00[UTC]",
        "2028-01-01T01:30:00+00:00[UTC]",
        "minutes",
        {
          smallestUnit: "minutes",
          roundingIncrement: 7,
          roundingMode: "trunc",
        },
      ),
    ).toBe("");
  });

  it.each`
    toStringSmallestUnit | fractionalSecondDigits | expected
    ${undefined}         | ${undefined}           | ${"PT1H"}
    ${"second"}          | ${undefined}           | ${"PT1H0S"}
    ${undefined}         | ${3}                   | ${"PT1H0.000S"}
  `(
    "applies toString precision options -> $expected",
    ({ toStringSmallestUnit, fractionalSecondDigits, expected }) => {
      expect(
        diffZonedAsDuration(
          "2028-01-01T00:00:00+00:00[UTC]",
          "2028-01-01T01:00:00+00:00[UTC]",
          "hours",
          { toStringSmallestUnit, fractionalSecondDigits },
        ),
      ).toBe(expected);
    },
  );
  // E5 (issue #78), decision of record D2 -- see addZoned.test.ts for the full rationale.
  // Temporal's own RFC 9557 string is GMT's calendar grammar. The two endpoints name
  // different calendars (hebrew, iso8601), so the result is "", as native Temporal (Chromium 153)
  // until throws "Mismatched calendars." (TC39 DifferenceTemporalZonedDateTime).
  it('returns "" for a calendar-annotated string against a bare one (different calendars)', () => {
    expect(
      diffZonedAsDuration(
        "2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]",
        "2024-06-30T23:59:59+00:00[UTC]",
        "months",
      ),
    ).toBe("");
  });
});

// ---------------------------------------------------------------------------------------------
// E7 (issue #152). Same-calendar values: @js-temporal/polyfill@0.5.1. Different calendars
// return "" (native Chromium 153 until throws "Mismatched calendars.").
// ---------------------------------------------------------------------------------------------
describe("diffZonedAsDuration with RFC 9557 calendar-annotated values", () => {
  const Y = calendarZonedFixtures.hebrewLeapYearSpan;
  const ISLAMIC_END =
    "2024-10-03T00:00:00-04:00[America/New_York][u-ca=islamic-tbla]";

  it.each`
    label                       | start                    | end                      | expected
    ${"both hebrew"}            | ${Y.tishri1_5784NewYork} | ${Y.tishri1_5785NewYork} | ${"P13M"}
    ${"both bare ISO"}          | ${Y.isoStart}            | ${Y.isoEnd}              | ${"P12M17D"}
    ${"mismatched tags"}        | ${Y.tishri1_5784NewYork} | ${ISLAMIC_END}           | ${""}
    ${"tagged start, bare end"} | ${Y.tishri1_5784NewYork} | ${Y.isoEnd}              | ${""}
  `(
    "returns $expected for $label measured in months",
    ({ start, end, expected }) => {
      expect(diffZonedAsDuration(start, end, "months")).toBe(expected);
    },
  );

  it.each`
    value                                                         | reason
    ${"5784-01-01T00:00:00-04:00[America/New_York][u-ca=hebrew]"} | ${"-04:00 is not New York's offset on ISO 5784-01-01 (EST)"}
    ${"2023-09-16T00:00:00-04:00[u-ca=hebrew][America/New_York]"} | ${"calendar before zone (not RFC 9557)"}
    ${"2024-13-15T14:30:00-05:00[America/New_York][u-ca=hebrew]"} | ${"ISO month 13 (the digits are ISO)"}
  `('returns "" when the start is $value ($reason)', ({ value }) => {
    expect(diffZonedAsDuration(value, Y.isoEnd, "days")).toBe("");
  });
});

// ---------------------------------------------------------------------------------------------
// CORE-6 S5: the calendar part of a zoned difference follows the Intl era/monthCode proposal's
// NonISODateUntil, exactly as the plain rows in diffDateAsDuration.test.ts do. Every value is
// Chromium 153 native Temporal (`PlainDate.withCalendar(c).toZonedDateTime(zone).until(…)`) or
// test262; offsets are the ones Chromium reads at those instants (New York keeps its -04:56:02
// local mean time before 1883).
// ---------------------------------------------------------------------------------------------
describe("diffZonedAsDuration in non-ISO calendars (CORE-6)", () => {
  it.each`
    start                                                                      | end                                                                        | unit        | expected     | reason
    ${"2023-08-31T00:00:00+00:00[UTC][u-ca=buddhist]"}                         | ${"2023-09-30T00:00:00+00:00[UTC][u-ca=buddhist]"}                         | ${"months"} | ${"P30D"}    | ${"D6: Aug 31 + 1 month is Sep 31, past Sep 30"}
    ${"2023-08-31T00:00:00-04:00[America/New_York][u-ca=buddhist]"}            | ${"2023-09-30T00:00:00-04:00[America/New_York][u-ca=buddhist]"}            | ${"months"} | ${"P30D"}    | ${"D6 in a named zone"}
    ${"2023-08-31T00:00:00-12:00[Etc/GMT+12][u-ca=buddhist]"}                  | ${"2023-09-30T00:00:00-12:00[Etc/GMT+12][u-ca=buddhist]"}                  | ${"years"}  | ${"P30D"}    | ${"D6 with largestUnit years"}
    ${"2023-08-31T00:00:00-04:00[America/New_York][u-ca=gregory]"}             | ${"2023-09-30T00:00:00-04:00[America/New_York][u-ca=gregory]"}             | ${"months"} | ${"P30D"}    | ${"D6 gregory (Chromium 153)"}
    ${"2023-06-19T00:00:00-04:00[America/New_York][u-ca=islamic-civil]"}       | ${"2023-07-18T00:00:00-04:00[America/New_York][u-ca=islamic-civil]"}       | ${"months"} | ${"P29D"}    | ${"D6 islamic-civil (ISO 2023-06-19 to 2023-07-18)"}
    ${"2024-02-11T00:00:00+00:00[UTC][u-ca=hebrew]"}                           | ${"2025-03-01T00:00:00+00:00[UTC][u-ca=hebrew]"}                           | ${"years"}  | ${"P12M29D"} | ${"D7: Adar I 2 + 1 year is Adar 2, past Adar 1"}
    ${"2024-02-11T00:00:00-05:00[America/New_York][u-ca=hebrew]"}              | ${"2025-03-01T00:00:00-05:00[America/New_York][u-ca=hebrew]"}              | ${"years"}  | ${"P12M29D"} | ${"D7 in a named zone"}
    ${"2025-03-01T00:00:00-12:00[Etc/GMT+12][u-ca=hebrew]"}                    | ${"2024-02-11T00:00:00-12:00[Etc/GMT+12][u-ca=hebrew]"}                    | ${"years"}  | ${"-P1Y29D"} | ${"D7 negated: Adar 1 - 1 year is Adar I 1, not past Adar I 2"}
    ${"+275760-07-06T00:00:00+00:00[UTC][u-ca=hebrew]"}                        | ${"+275760-09-13T00:00:00+00:00[UTC][u-ca=hebrew]"}                        | ${"months"} | ${"P2M10D"}  | ${"D1: up to the maximum instant"}
    ${"+275760-07-06T00:00:00-04:00[America/New_York][u-ca=hebrew]"}           | ${"+275760-09-12T00:00:00-04:00[America/New_York][u-ca=hebrew]"}           | ${"months"} | ${"P2M9D"}   | ${"D1 near the maximum in a named zone"}
    ${"+275760-07-06T00:00:00-12:00[Etc/GMT+12][u-ca=hebrew]"}                 | ${"+275760-09-12T00:00:00-12:00[Etc/GMT+12][u-ca=hebrew]"}                 | ${"months"} | ${"P2M9D"}   | ${"D1 near the maximum behind UTC"}
    ${"-271821-06-03T12:00:00+00:00[UTC][u-ca=islamic-civil]"}                 | ${"-271820-05-23T12:00:00+00:00[UTC][u-ca=islamic-civil]"}                 | ${"years"}  | ${"P1Y"}     | ${"D1 near the minimum (ISO -271821-06-03 to -271820-05-23)"}
    ${"-271821-06-03T12:00:00-04:56:02[America/New_York][u-ca=islamic-civil]"} | ${"-271820-05-23T12:00:00-04:56:02[America/New_York][u-ca=islamic-civil]"} | ${"years"}  | ${"P1Y"}     | ${"D1 near the minimum in a named zone"}
    ${"-271821-06-03T12:00:00-12:00[Etc/GMT+12][u-ca=islamic-civil]"}          | ${"-271820-05-23T12:00:00-12:00[Etc/GMT+12][u-ca=islamic-civil]"}          | ${"years"}  | ${"P1Y"}     | ${"D1 near the minimum behind UTC"}
    ${"1000-01-31T00:00:00+00:00[UTC][u-ca=buddhist]"}                         | ${"1000-02-28T00:00:00+00:00[UTC][u-ca=buddhist]"}                         | ${"months"} | ${"P28D"}    | ${"proleptic buddhist: ISO 1000-01-31 to 1000-02-28, no Julian leap day"}
    ${"1000-01-31T00:00:00-04:56:02[America/New_York][u-ca=buddhist]"}         | ${"1000-02-28T00:00:00-04:56:02[America/New_York][u-ca=buddhist]"}         | ${"months"} | ${"P28D"}    | ${"proleptic buddhist in a named zone"}
    ${"-100000-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"}                        | ${"-100000-02-10T00:00:00+00:00[UTC][u-ca=hebrew]"}                        | ${"months"} | ${"P1M11D"}  | ${"hebrew year <= 0: ISO -100000-01-01 + 40 days"}
    ${"-100000-01-01T00:00:00-04:56:02[America/New_York][u-ca=hebrew]"}        | ${"-100000-02-10T00:00:00-04:56:02[America/New_York][u-ca=hebrew]"}        | ${"months"} | ${"P1M11D"}  | ${"hebrew year <= 0 in a named zone"}
  `(
    "returns $expected from $start to $end in $unit ($reason)",
    ({ start, end, unit, expected }) => {
      expect(diffZonedAsDuration(start, end, unit)).toBe(expected);
    },
  );
});

describe("diffZonedAsDuration at the maximum instant", () => {
  // diffZonedAsDuration measures in UTC. From max - 3d5h to max, TC39 NudgeToZonedTime rounds
  // P3DT5H to an hour by resolving +275760-09-13T19:00 in UTC, 19 hours past the maximum, which
  // GetPossibleEpochNanoseconds rejects, so Temporal throws whatever zone the operands carry.
  it.each`
    value1                                              | value2
    ${"+275760-09-09T19:00:00+00:00[UTC]"}              | ${"+275760-09-13T00:00:00+00:00[UTC]"}
    ${"+275760-09-09T19:00:00+00:00[+00:00]"}           | ${"+275760-09-13T00:00:00+00:00[+00:00]"}
    ${"+275760-09-09T20:00:00+01:00[Europe/London]"}    | ${"+275760-09-13T01:00:00+01:00[Europe/London]"}
    ${"+275760-09-10T05:00:00+10:00[Australia/Sydney]"} | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}
  `(
    'returns "" rounding days to an hour from $value1 to $value2',
    ({ value1, value2 }) => {
      expect(
        diffZonedAsDuration(value1, value2, "days", { smallestUnit: "hour" }),
      ).toBe("");
    },
  );

  it("returns P5DT5H rounding days to an hour from max - 10d5h to max - 5d", () => {
    expect(
      diffZonedAsDuration(
        "+275760-09-02T19:00:00+00:00[UTC]",
        "+275760-09-08T00:00:00+00:00[UTC]",
        "days",
        { smallestUnit: "hour" },
      ),
    ).toBe("P5DT5H");
  });
});

describe("diffZonedAsDuration at the minimum instant", () => {
  // diffZonedAsDuration measures in UTC. From min + 2d5h back to min (-271821-04-20T00:00Z), TC39
  // NudgeToZonedTime resolves the end of the day window, -271821-04-19T05:00 in UTC, 19 hours before
  // the minimum, so Temporal throws. Five days later the window stays in range.
  it.each`
    value1                                    | value2                                    | expected
    ${"-271821-04-22T05:00:00+00:00[UTC]"}    | ${"-271821-04-20T00:00:00+00:00[UTC]"}    | ${""}
    ${"-271821-04-22T05:00:00+00:00[+00:00]"} | ${"-271821-04-20T00:00:00+00:00[+00:00]"} | ${""}
    ${"-271821-04-27T05:00:00+00:00[UTC]"}    | ${"-271821-04-25T00:00:00+00:00[UTC]"}    | ${"-P2DT5H"}
  `(
    "returns $expected rounding days to an hour from $value1 back to $value2",
    ({ value1, value2, expected }) => {
      expect(
        diffZonedAsDuration(value1, value2, "days", { smallestUnit: "hour" }),
      ).toBe(expected);
    },
  );
});

// Temporal GetOptionsObject: an options argument that is not an object or undefined throws
// TypeError (native Chromium 153: `until(other, null)`, `"x"`, `5` and `true` all throw), so each is
// invalid input. Omitted options measure normally (PT49H).
describe("diffZonedAsDuration with a non-object options argument", () => {
  it.each`
    options      | expected
    ${null}      | ${""}
    ${"x"}       | ${""}
    ${5}         | ${""}
    ${true}      | ${""}
    ${undefined} | ${"PT49H"}
  `("returns $expected for options $options", ({ options, expected }) => {
    expect(
      diffZonedAsDuration(
        "2024-02-28T14:30:00+00:00[UTC]",
        "2024-03-01T15:30:00+00:00[UTC]",
        "hours",
        options,
      ),
    ).toBe(expected);
  });
});

// Temporal §13.17: largestUnit "day" and "days" are the same unit. Native Chromium 153:
// 2024-02-28T14:30:00+00:00[UTC] until 2024-03-01T15:30:00+00:00[UTC] is P2DT1H with largestUnit day, PT49H with hour.
describe("diffZonedAsDuration with singular unit names", () => {
  it.each`
    unit      | expected
    ${"day"}  | ${"P2DT1H"}
    ${"hour"} | ${"PT49H"}
  `("returns $expected for unit $unit", ({ unit, expected }) => {
    expect(
      diffZonedAsDuration(
        "2024-02-28T14:30:00+00:00[UTC]",
        "2024-03-01T15:30:00+00:00[UTC]",
        unit,
      ),
    ).toBe(expected);
  });
});
