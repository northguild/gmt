import { areDateTimesEqualBy } from "./areDateTimesEqualBy";

describe("areDateTimesEqualBy", () => {
  it.each`
    value1                             | value2                             | unit
    ${"2024-03-15T10:00:00"}           | ${"2024-03-15T20:00:00"}           | ${"day"}
    ${"2024-03-01T00:00:00"}           | ${"2024-03-31T23:59:59"}           | ${"month"}
    ${"2024-01-01T00:00:00"}           | ${"2024-12-31T23:59:59"}           | ${"year"}
    ${"2024-03-11T00:00:00"}           | ${"2024-03-17T23:59:59"}           | ${"week"}
    ${"2024-03-15T10:15:00"}           | ${"2024-03-15T10:45:00"}           | ${"hour"}
    ${"2024-03-15T10:15:30"}           | ${"2024-03-15T10:15:59"}           | ${"minute"}
    ${"2024-03-15T10:15:30.100"}       | ${"2024-03-15T10:15:30.900"}       | ${"second"}
    ${"2024-03-15T10:15:30.100100"}    | ${"2024-03-15T10:15:30.100900"}    | ${"millisecond"}
    ${"2024-03-15T10:15:30.100100100"} | ${"2024-03-15T10:15:30.100100900"} | ${"microsecond"}
    ${"2024-03-15T10:15:30.100100100"} | ${"2024-03-15T10:15:30.100100100"} | ${"nanosecond"}
  `(
    "returns true for $value1 and $value2 equal by $unit",
    ({ value1, value2, unit }) => {
      expect(areDateTimesEqualBy(value1, value2, unit)).toBe(true);
    },
  );

  it.each`
    value1                             | value2                             | unit
    ${"2024-03-15T10:00:00"}           | ${"2024-03-16T10:00:00"}           | ${"day"}
    ${"2024-03-31T00:00:00"}           | ${"2024-04-01T00:00:00"}           | ${"month"}
    ${"2024-01-01T00:00:00"}           | ${"2025-01-01T00:00:00"}           | ${"year"}
    ${"2024-03-17T00:00:00"}           | ${"2024-03-18T00:00:00"}           | ${"week"}
    ${"2024-03-15T10:00:00"}           | ${"2024-03-15T11:00:00"}           | ${"hour"}
    ${"2024-03-15T10:15:00"}           | ${"2024-03-15T10:16:00"}           | ${"minute"}
    ${"2024-03-15T10:15:30.000"}       | ${"2024-03-15T10:15:31.000"}       | ${"second"}
    ${"2024-03-15T10:15:30.100"}       | ${"2024-03-15T10:15:30.200"}       | ${"millisecond"}
    ${"2024-03-15T10:15:30.100100100"} | ${"2024-03-15T10:15:30.100200100"} | ${"microsecond"}
    ${"2024-03-15T10:15:30.100100100"} | ${"2024-03-15T10:15:30.100100200"} | ${"nanosecond"}
  `(
    "returns false for $value1 and $value2 unequal by $unit",
    ({ value1, value2, unit }) => {
      expect(areDateTimesEqualBy(value1, value2, unit)).toBe(false);
    },
  );

  it("returns false when the same month falls in different years", () => {
    expect(
      areDateTimesEqualBy(
        "2023-03-15T00:00:00",
        "2024-03-15T00:00:00",
        "month",
      ),
    ).toBe(false);
  });

  it.each`
    weekStartsOn | expected
    ${"monday"}  | ${true}
    ${"sunday"}  | ${false}
  `(
    "returns $expected for 2024-03-11 vs 2024-03-17 by week when weekStartsOn is $weekStartsOn",
    ({ weekStartsOn, expected }) => {
      expect(
        areDateTimesEqualBy(
          "2024-03-11T00:00:00",
          "2024-03-17T00:00:00",
          "week",
          { weekStartsOn },
        ),
      ).toBe(expected);
    },
  );

  // "Equal by unit" is bucket equality: both floors of `unit` are the same instant.
  it.each`
    value1                             | value2                             | unit             | expected
    ${"2024-05-15T10:20:30.123"}       | ${"2024-05-15T10:20:30.999"}       | ${"millisecond"} | ${false}
    ${"2024-05-15T10:20:30.123456"}    | ${"2024-05-15T10:20:30.123999"}    | ${"microsecond"} | ${false}
    ${"2024-05-15T10:20:30.123456789"} | ${"2024-05-15T10:20:30.123456788"} | ${"nanosecond"}  | ${false}
    ${"2024-05-15T10:20:30.123456"}    | ${"2024-05-15T10:20:30.123999"}    | ${"millisecond"} | ${true}
    ${"2024-05-15T10:20:30.123"}       | ${"2024-05-15T10:20:30.999"}       | ${"second"}      | ${true}
  `(
    "returns $expected for $value1 and $value2 by $unit",
    ({ value1, value2, unit, expected }) => {
      expect(areDateTimesEqualBy(value1, value2, unit)).toBe(expected);
    },
  );

  // `fractionalSecondDigits` was removed in 1.16.0: it was ignored, because equality compares
  // buckets, not printed strings. Passing it is a type error, and a JavaScript caller's stray
  // property changes nothing — two milliseconds that print alike at 0 digits still differ.
  it("treats the removed fractionalSecondDigits option as a type error and ignores it at runtime", () => {
    expect(
      areDateTimesEqualBy(
        "2024-05-15T10:20:30.123",
        "2024-05-15T10:20:30.999",
        "millisecond",
        {
          // @ts-expect-error -- `fractionalSecondDigits` was removed in 1.16.0
          fractionalSecondDigits: 0,
        },
      ),
    ).toBe(false);
  });

  it("returns false for an unsupported unit", () => {
    expect(
      areDateTimesEqualBy(
        "2024-03-15T00:00:00",
        "2024-03-15T00:00:00",
        "decade" as never,
      ),
    ).toBe(false);
  });

  it.each`
    value1                   | value2
    ${""}                    | ${""}
    ${null}                  | ${"2024-03-15T00:00:00"}
    ${undefined}             | ${"2024-03-15T00:00:00"}
    ${"not-a-datetime"}      | ${"2024-03-15T00:00:00"}
    ${"2024-03-15T00:00:00"} | ${null}
    ${"2024-03-15T00:00:00"} | ${undefined}
    ${"2024-03-15T00:00:00"} | ${"not-a-datetime"}
  `(
    "returns false for invalid input $value1 and $value2",
    ({ value1, value2 }) => {
      expect(
        areDateTimesEqualBy(value1 as never, value2 as never, "month"),
      ).toBe(false);
    },
  );

  // Temporal §13.17 GetTemporalUnitValuedOption: a plural unit name is the same unit as its singular.
  it.each`
    unit              | value1                             | value2                             | expected
    ${"years"}        | ${"2024-01-01T12:00:00"}           | ${"2024-12-31T12:00:00"}           | ${true}
    ${"years"}        | ${"2024-12-31T12:00:00"}           | ${"2025-01-01T12:00:00"}           | ${false}
    ${"months"}       | ${"2024-02-01T12:00:00"}           | ${"2024-02-29T12:00:00"}           | ${true}
    ${"months"}       | ${"2024-02-29T12:00:00"}           | ${"2024-03-01T12:00:00"}           | ${false}
    ${"weeks"}        | ${"2024-02-26T12:00:00"}           | ${"2024-03-03T12:00:00"}           | ${true}
    ${"weeks"}        | ${"2024-03-03T12:00:00"}           | ${"2024-03-04T12:00:00"}           | ${false}
    ${"days"}         | ${"2024-02-29T12:00:00"}           | ${"2024-02-29T12:00:00"}           | ${true}
    ${"days"}         | ${"2024-02-29T12:00:00"}           | ${"2024-03-01T12:00:00"}           | ${false}
    ${"hours"}        | ${"2024-02-29T13:00:00"}           | ${"2024-02-29T13:59:59.999999999"} | ${true}
    ${"hours"}        | ${"2024-02-29T13:59:59.999999999"} | ${"2024-02-29T14:00:00"}           | ${false}
    ${"minutes"}      | ${"2024-02-29T13:45:00"}           | ${"2024-02-29T13:45:59.999999999"} | ${true}
    ${"minutes"}      | ${"2024-02-29T13:45:59.999999999"} | ${"2024-02-29T13:46:00"}           | ${false}
    ${"seconds"}      | ${"2024-02-29T13:45:30"}           | ${"2024-02-29T13:45:30.999999999"} | ${true}
    ${"seconds"}      | ${"2024-02-29T13:45:30.999999999"} | ${"2024-02-29T13:45:31"}           | ${false}
    ${"milliseconds"} | ${"2024-02-29T13:45:30.123"}       | ${"2024-02-29T13:45:30.123999999"} | ${true}
    ${"milliseconds"} | ${"2024-02-29T13:45:30.123999999"} | ${"2024-02-29T13:45:30.124"}       | ${false}
    ${"microseconds"} | ${"2024-02-29T13:45:30.123456"}    | ${"2024-02-29T13:45:30.123456999"} | ${true}
    ${"microseconds"} | ${"2024-02-29T13:45:30.123456999"} | ${"2024-02-29T13:45:30.123457"}    | ${false}
    ${"nanoseconds"}  | ${"2024-02-29T13:45:30.123456789"} | ${"2024-02-29T13:45:30.123456789"} | ${true}
    ${"nanoseconds"}  | ${"2024-02-29T13:45:30.123456789"} | ${"2024-02-29T13:45:30.12345679"}  | ${false}
  `(
    "returns $expected for $value1 and $value2 by plural unit $unit",
    ({ unit, value1, value2, expected }) => {
      expect(areDateTimesEqualBy(value1, value2, unit)).toBe(expected);
    },
  );

  // weekStartsOn only names "monday" or "sunday"; any other value is invalid input, for every unit
  // (Temporal GetOption rejects a value outside its allowed list; undefined means the default).
  it.each`
    unit      | weekStartsOn
    ${"week"} | ${"tuesday"}
    ${"week"} | ${"Monday"}
    ${"week"} | ${""}
    ${"week"} | ${null}
    ${"week"} | ${1}
    ${"week"} | ${true}
    ${"day"}  | ${"tuesday"}
    ${"day"}  | ${"Monday"}
    ${"day"}  | ${""}
    ${"day"}  | ${null}
    ${"day"}  | ${1}
    ${"day"}  | ${true}
  `(
    "returns false by unit $unit with invalid weekStartsOn $weekStartsOn",
    ({ unit, weekStartsOn }) => {
      expect(
        areDateTimesEqualBy(
          "2024-02-29T13:45:30",
          "2024-02-29T13:45:30",
          unit,
          { weekStartsOn },
        ),
      ).toBe(false);
    },
  );
});
