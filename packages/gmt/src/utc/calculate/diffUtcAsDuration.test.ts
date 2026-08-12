import { diffUtcAsDuration } from "./diffUtcAsDuration";

describe("diffUtcAsDuration", () => {
  it.each`
    value1                    | value2                    | unit         | expected
    ${"2028-01-01T00:00:00Z"} | ${"2029-01-01T00:00:00Z"} | ${"years"}   | ${"P1Y"}
    ${"2028-01-01T00:00:00Z"} | ${"2028-02-01T00:00:00Z"} | ${"months"}  | ${"P1M"}
    ${"2028-01-01T00:00:00Z"} | ${"2028-01-08T00:00:00Z"} | ${"weeks"}   | ${"P1W"}
    ${"2028-01-01T00:00:00Z"} | ${"2028-01-02T00:00:00Z"} | ${"days"}    | ${"P1D"}
    ${"2028-01-01T00:00:00Z"} | ${"2028-01-01T01:00:00Z"} | ${"hours"}   | ${"PT1H"}
    ${"2028-01-01T00:00:00Z"} | ${"2028-01-01T00:01:00Z"} | ${"minutes"} | ${"PT1M"}
    ${"2028-01-01T00:00:00Z"} | ${"2028-01-01T00:00:01Z"} | ${"seconds"} | ${"PT1S"}
  `(
    "returns $expected for single $unit comparing $value1, $value2",
    ({ value1, value2, unit, expected }) => {
      expect(diffUtcAsDuration(value1, value2, unit)).toBe(expected);
    },
  );

  it("promotes to largestUnit hours: PT24H for a 1-day span", () => {
    expect(
      diffUtcAsDuration(
        "2024-03-10T12:00:00Z",
        "2024-03-11T12:00:00Z",
        "hours",
      ),
    ).toBe("PT24H");
  });

  it("returns negative duration for value1 after value2", () => {
    expect(
      diffUtcAsDuration(
        "2024-03-11T12:00:00Z",
        "2024-03-10T12:00:00Z",
        "hours",
      ),
    ).toBe("-PT24H");
  });

  it("returns PT0S for a zero-length diff", () => {
    expect(
      diffUtcAsDuration(
        "2028-01-01T00:00:00Z",
        "2028-01-01T00:00:00Z",
        "hours",
      ),
    ).toBe("PT0S");
  });

  it.each`
    value1                    | value2                    | unit
    ${"invalid"}              | ${"2024-03-01T00:00:00Z"} | ${"days"}
    ${"2024-03-01T00:00:00Z"} | ${"invalid"}              | ${"days"}
    ${""}                     | ${"2024-03-01T00:00:00Z"} | ${"days"}
    ${null}                   | ${"2024-03-01T00:00:00Z"} | ${"days"}
    ${"2024-03-01T00:00:00Z"} | ${"2024-03-02T00:00:00Z"} | ${"invalid"}
    ${"2024-03-01T00:00:00Z"} | ${"2024-03-02T00:00:00Z"} | ${["days"]}
  `(
    'returns "" for invalid inputs: $value1 | $value2 | $unit',
    ({ value1, value2, unit }) => {
      expect(
        diffUtcAsDuration(value1 as never, value2 as never, unit as never),
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
        diffUtcAsDuration(
          "2028-01-01T00:00:00Z",
          "2028-01-01T01:30:00Z",
          "hours",
          { smallestUnit: "hours", roundingMode },
        ),
      ).toBe(expected);
    },
  );

  it("returns the unrounded result when no rounding options are provided", () => {
    expect(
      diffUtcAsDuration(
        "2028-01-01T00:00:00Z",
        "2028-01-01T01:40:00Z",
        "minutes",
      ),
    ).toBe("PT100M");
  });

  it('returns "" when roundingIncrement does not evenly divide the unit', () => {
    expect(
      diffUtcAsDuration(
        "2028-01-01T00:00:00Z",
        "2028-01-01T01:30:00Z",
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
        diffUtcAsDuration(
          "2028-01-01T00:00:00Z",
          "2028-01-01T01:00:00Z",
          "hours",
          { toStringSmallestUnit, fractionalSecondDigits },
        ),
      ).toBe(expected);
    },
  );
});
