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
