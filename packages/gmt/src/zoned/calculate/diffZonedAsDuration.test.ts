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
});
