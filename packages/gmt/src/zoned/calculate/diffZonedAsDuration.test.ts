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

  it("supports multi timeZone diffs", () => {
    expect(
      diffZonedAsDuration(
        "2028-01-01T00:00:00+00:00[UTC]",
        "2028-01-02T13:00:00+13:00[Pacific/Apia]",
        "days",
      ),
    ).toBe("P1D");
  });

  it("rounds a span crossing the America/New_York spring-forward DST gap to the real 47-hour elapsed time", () => {
    expect(
      diffZonedAsDuration(
        "2024-03-09T12:00:00-05:00[America/New_York]",
        "2024-03-11T12:00:00-04:00[America/New_York]",
        "days",
      ),
    ).toBe("P1DT23H");
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

  it("rounds the same 90-minute instant span to 2 hours regardless of timeZone (UTC-normalized before rounding)", () => {
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
  it('returns "" when value1 carries a calendar annotation', () => {
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
// E7 (issue #152), D5-zoned. Every expected value produced by running
// @js-temporal/polyfill@0.5.1.
// ---------------------------------------------------------------------------------------------
describe("diffZonedAsDuration with GMT calendar-annotated values", () => {
  const Y = calendarZonedFixtures.hebrewLeapYearSpan;
  const ISLAMIC_END =
    "1446-03-30T00:00:00-04:00[u-ca=islamic-tabular][America/New_York]";

  it.each`
    label                       | start                    | end                      | expected
    ${"both hebrew"}            | ${Y.tishri1_5784NewYork} | ${Y.tishri1_5785NewYork} | ${"P13M"}
    ${"both bare ISO"}          | ${Y.isoStart}            | ${Y.isoEnd}              | ${"P12M17D"}
    ${"mismatched tags"}        | ${Y.tishri1_5784NewYork} | ${ISLAMIC_END}           | ${"P12M17D"}
    ${"tagged start, bare end"} | ${Y.tishri1_5784NewYork} | ${Y.isoEnd}              | ${"P12M17D"}
  `(
    "returns $expected for $label measured in months",
    ({ start, end, expected }) => {
      expect(diffZonedAsDuration(start, end, "months")).toBe(expected);
    },
  );

  it.each`
    value                                                         | reason
    ${"5784-01-01T00:00:00-04:00[America/New_York][u-ca=hebrew]"} | ${"GMT digits in Temporal's segment ordering"}
    ${"5785-13-15T14:30:00-05:00[u-ca=hebrew][America/New_York]"} | ${"month 13 in a non-leap Hebrew year"}
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
    ${"2566-08-31T00:00:00+00:00[u-ca=buddhist][UTC]"}                         | ${"2566-09-30T00:00:00+00:00[u-ca=buddhist][UTC]"}                         | ${"months"} | ${"P30D"}    | ${"D6: Aug 31 + 1 month is Sep 31, past Sep 30"}
    ${"2566-08-31T00:00:00-04:00[u-ca=buddhist][America/New_York]"}            | ${"2566-09-30T00:00:00-04:00[u-ca=buddhist][America/New_York]"}            | ${"months"} | ${"P30D"}    | ${"D6 in a named zone"}
    ${"2566-08-31T00:00:00-12:00[u-ca=buddhist][Etc/GMT+12]"}                  | ${"2566-09-30T00:00:00-12:00[u-ca=buddhist][Etc/GMT+12]"}                  | ${"years"}  | ${"P30D"}    | ${"D6 with largestUnit years"}
    ${"1444-11-30T00:00:00-04:00[u-ca=islamic-civil][America/New_York]"}       | ${"1444-12-29T00:00:00-04:00[u-ca=islamic-civil][America/New_York]"}       | ${"months"} | ${"P29D"}    | ${"D6 islamic-civil (ISO 2023-06-19 to 2023-07-18)"}
    ${"5784-06-02T00:00:00+00:00[u-ca=hebrew][UTC]"}                           | ${"5785-06-01T00:00:00+00:00[u-ca=hebrew][UTC]"}                           | ${"years"}  | ${"P12M29D"} | ${"D7: Adar I 2 + 1 year is Adar 2, past Adar 1"}
    ${"5784-06-02T00:00:00-05:00[u-ca=hebrew][America/New_York]"}              | ${"5785-06-01T00:00:00-05:00[u-ca=hebrew][America/New_York]"}              | ${"years"}  | ${"P12M29D"} | ${"D7 in a named zone"}
    ${"5785-06-01T00:00:00-12:00[u-ca=hebrew][Etc/GMT+12]"}                    | ${"5784-06-02T00:00:00-12:00[u-ca=hebrew][Etc/GMT+12]"}                    | ${"years"}  | ${"-P1Y29D"} | ${"D7 negated: Adar 1 - 1 year is Adar I 1, not past Adar I 2"}
    ${"279517-08-01T00:00:00+00:00[u-ca=hebrew][UTC]"}                         | ${"279517-10-11T00:00:00+00:00[u-ca=hebrew][UTC]"}                         | ${"months"} | ${"P2M10D"}  | ${"D1: up to the maximum instant"}
    ${"279517-08-01T00:00:00-04:00[u-ca=hebrew][America/New_York]"}            | ${"279517-10-10T00:00:00-04:00[u-ca=hebrew][America/New_York]"}            | ${"months"} | ${"P2M9D"}   | ${"D1 near the maximum in a named zone"}
    ${"279517-08-01T00:00:00-12:00[u-ca=hebrew][Etc/GMT+12]"}                  | ${"279517-10-10T00:00:00-12:00[u-ca=hebrew][Etc/GMT+12]"}                  | ${"months"} | ${"P2M9D"}   | ${"D1 near the maximum behind UTC"}
    ${"-280804-05-07T12:00:00+00:00[u-ca=islamic-civil][UTC]"}                 | ${"-280803-05-07T12:00:00+00:00[u-ca=islamic-civil][UTC]"}                 | ${"years"}  | ${"P1Y"}     | ${"D1 near the minimum (ISO -271821-06-03 to -271820-05-23)"}
    ${"-280804-05-07T12:00:00-04:56:02[u-ca=islamic-civil][America/New_York]"} | ${"-280803-05-07T12:00:00-04:56:02[u-ca=islamic-civil][America/New_York]"} | ${"years"}  | ${"P1Y"}     | ${"D1 near the minimum in a named zone"}
    ${"-280804-05-07T12:00:00-12:00[u-ca=islamic-civil][Etc/GMT+12]"}          | ${"-280803-05-07T12:00:00-12:00[u-ca=islamic-civil][Etc/GMT+12]"}          | ${"years"}  | ${"P1Y"}     | ${"D1 near the minimum behind UTC"}
    ${"1543-01-31T00:00:00+00:00[u-ca=buddhist][UTC]"}                         | ${"1543-02-28T00:00:00+00:00[u-ca=buddhist][UTC]"}                         | ${"months"} | ${"P28D"}    | ${"proleptic buddhist: ISO 1000-01-31 to 1000-02-28, no Julian leap day"}
    ${"1543-01-31T00:00:00-04:56:02[u-ca=buddhist][America/New_York]"}         | ${"1543-02-28T00:00:00-04:56:02[u-ca=buddhist][America/New_York]"}         | ${"months"} | ${"P28D"}    | ${"proleptic buddhist in a named zone"}
    ${"-096239-06-23T00:00:00+00:00[u-ca=hebrew][UTC]"}                        | ${"-096239-08-04T00:00:00+00:00[u-ca=hebrew][UTC]"}                        | ${"months"} | ${"P1M11D"}  | ${"hebrew year <= 0: ISO -100000-01-01 + 40 days"}
    ${"-096239-06-23T00:00:00-04:56:02[u-ca=hebrew][America/New_York]"}        | ${"-096239-08-04T00:00:00-04:56:02[u-ca=hebrew][America/New_York]"}        | ${"months"} | ${"P1M11D"}  | ${"hebrew year <= 0 in a named zone"}
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
