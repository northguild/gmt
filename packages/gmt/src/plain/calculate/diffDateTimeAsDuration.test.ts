import { diffDateTimeAsDuration } from "./diffDateTimeAsDuration";

describe("diffDateTimeAsDuration", () => {
  it.each`
    dateTime1                | dateTime2                | unit         | expected
    ${"2023-01-01T00:00:00"} | ${"2024-01-01T00:00:00"} | ${"years"}   | ${"P1Y"}
    ${"2023-01-01T00:00:00"} | ${"2023-02-01T00:00:00"} | ${"months"}  | ${"P1M"}
    ${"2023-01-01T00:00:00"} | ${"2023-01-08T00:00:00"} | ${"weeks"}   | ${"P1W"}
    ${"2023-01-01T00:00:00"} | ${"2023-01-02T00:00:00"} | ${"days"}    | ${"P1D"}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T01:00:00"} | ${"hours"}   | ${"PT1H"}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T00:01:00"} | ${"minutes"} | ${"PT1M"}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T00:00:01"} | ${"seconds"} | ${"PT1S"}
  `(
    "returns $expected for single $unit comparing $dateTime1, $dateTime2",
    ({ dateTime1, dateTime2, unit, expected }) => {
      expect(diffDateTimeAsDuration(dateTime1, dateTime2, unit)).toBe(expected);
    },
  );

  it("promotes to largestUnit days: P1DT2H for a 26-hour span", () => {
    expect(
      diffDateTimeAsDuration(
        "2024-03-10T00:00:00",
        "2024-03-11T02:00:00",
        "days",
      ),
    ).toBe("P1DT2H");
  });

  it.each`
    dateTime1                | dateTime2                | expected
    ${"2024-03-11T02:00:00"} | ${"2024-03-10T00:00:00"} | ${"-P1DT2H"}
    ${"2024-02-29T12:00:00"} | ${"2024-02-29T11:59:59"} | ${"-PT1S"}
  `(
    "returns negative duration for dateTime1 after dateTime2: $dateTime1, $dateTime2",
    ({ dateTime1, dateTime2, expected }) => {
      expect(diffDateTimeAsDuration(dateTime1, dateTime2, "days")).toBe(
        expected,
      );
    },
  );

  it("returns PT0S for a zero-length diff", () => {
    expect(
      diffDateTimeAsDuration(
        "2024-01-01T00:00:00",
        "2024-01-01T00:00:00",
        "hours",
      ),
    ).toBe("PT0S");
  });

  it.each`
    invalidDateTime1
    ${"2024-02-30T12:00:00"}
    ${"not-a-datetime"}
    ${"2024-13-01T12:00:00"}
    ${"2024-00-10T12:00:00"}
    ${""}
    ${true}
    ${null}
    ${undefined}
    ${"12"}
    ${"2024"}
    ${"2024-02"}
    ${"2024-02-29"}
    ${"12:00:00"}
    ${"2024-02-29T25:00:00"}
  `(
    'returns "" for invalid dateTime1 $invalidDateTime1',
    ({ invalidDateTime1 }) => {
      expect(
        diffDateTimeAsDuration(
          invalidDateTime1 as never,
          "2024-01-01T00:00:00",
          "days",
        ),
      ).toBe("");
    },
  );

  it.each`
    invalidDateTime2
    ${"2024-02-30T12:00:00"}
    ${"not-a-datetime"}
    ${"2024-13-01T12:00:00"}
    ${"2024-00-10T12:00:00"}
    ${""}
    ${true}
    ${null}
    ${undefined}
    ${"12"}
    ${"2024"}
    ${"2024-02"}
    ${"2024-02-29"}
    ${"12:00:00"}
    ${"2024-02-29T25:00:00"}
  `(
    'returns "" for invalid dateTime2 $invalidDateTime2',
    ({ invalidDateTime2 }) => {
      expect(
        diffDateTimeAsDuration(
          "2024-01-01T00:00:00",
          invalidDateTime2 as never,
          "days",
        ),
      ).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
    ${"hour"}
    ${"day"}
    ${"month"}
    ${"year"}
    ${["days"]}
  `('returns "" for invalid unit $invalidUnit', ({ invalidUnit }) => {
    expect(
      diffDateTimeAsDuration(
        "2024-01-01T00:00:00",
        "2024-01-02T00:00:00",
        invalidUnit as never,
      ),
    ).toBe("");
  });

  it.each`
    roundingMode    | expected
    ${"ceil"}       | ${"PT2H"}
    ${"floor"}      | ${"PT1H"}
    ${"trunc"}      | ${"PT1H"}
    ${"halfExpand"} | ${"PT2H"}
    ${"halfCeil"}   | ${"PT2H"}
    ${"halfFloor"}  | ${"PT1H"}
    ${"halfTrunc"}  | ${"PT1H"}
    ${"halfEven"}   | ${"PT2H"}
    ${"expand"}     | ${"PT2H"}
  `(
    "rounds a 90-minute span to $expected with smallestUnit hour, roundingMode $roundingMode",
    ({ roundingMode, expected }) => {
      expect(
        diffDateTimeAsDuration(
          "2024-02-29T00:00:00",
          "2024-02-29T01:30:00",
          "hours",
          {
            smallestUnit: "hours",
            roundingMode,
          },
        ),
      ).toBe(expected);
    },
  );

  it("returns the unrounded result when no options are provided", () => {
    expect(
      diffDateTimeAsDuration(
        "2024-02-29T00:00:00",
        "2024-02-29T01:40:00",
        "hours",
      ),
    ).toBe("PT1H40M");
  });

  it('returns "" when roundingIncrement is invalid for the unit (does not divide evenly)', () => {
    expect(
      diffDateTimeAsDuration(
        "2024-02-29T00:00:00",
        "2024-02-29T00:32:00",
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
        diffDateTimeAsDuration(
          "2024-02-29T00:00:00",
          "2024-02-29T01:00:00",
          "hours",
          { toStringSmallestUnit, fractionalSecondDigits },
        ),
      ).toBe(expected);
    },
  );
});
