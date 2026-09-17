import { areUtcEqualBy } from "./areUtcEqualBy";

describe("areUtcEqualBy", () => {
  it.each`
    value1                    | value2                    | unit
    ${"2024-03-15T02:00:00Z"} | ${"2024-03-15T22:00:00Z"} | ${"day"}
    ${"2024-03-01T00:00:00Z"} | ${"2024-03-31T23:59:59Z"} | ${"month"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${"year"}
    ${"2024-03-11T00:00:00Z"} | ${"2024-03-17T23:59:59Z"} | ${"week"}
    ${"2024-03-15T10:15:00Z"} | ${"2024-03-15T10:45:00Z"} | ${"hour"}
  `(
    "returns true for $value1 and $value2 equal by $unit",
    ({ value1, value2, unit }) => {
      expect(areUtcEqualBy(value1, value2, unit)).toBe(true);
    },
  );

  it.each`
    value1                    | value2                    | unit
    ${"2024-03-15T23:30:00Z"} | ${"2024-03-16T00:30:00Z"} | ${"day"}
    ${"2024-03-31T23:59:59Z"} | ${"2024-04-01T00:00:00Z"} | ${"month"}
    ${"2024-12-31T23:59:59Z"} | ${"2025-01-01T00:00:00Z"} | ${"year"}
    ${"2024-03-17T00:00:00Z"} | ${"2024-03-18T00:00:00Z"} | ${"week"}
    ${"2024-03-15T10:00:00Z"} | ${"2024-03-15T11:00:00Z"} | ${"hour"}
  `(
    "returns false for $value1 and $value2 unequal at the next-finer unit than $unit",
    ({ value1, value2, unit }) => {
      expect(areUtcEqualBy(value1, value2, unit)).toBe(false);
    },
  );

  it("returns false when the same month falls in different years", () => {
    expect(
      areUtcEqualBy("2023-03-15T00:00:00Z", "2024-03-15T00:00:00Z", "month"),
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
        areUtcEqualBy("2024-03-11T00:00:00Z", "2024-03-17T00:00:00Z", "week", {
          weekStartsOn,
        }),
      ).toBe(expected);
    },
  );

  // "Equal by unit" is bucket equality: both floors of `unit` are the same instant.
  it.each`
    value1                              | value2                              | unit             | expected
    ${"2024-05-15T10:20:30.123Z"}       | ${"2024-05-15T10:20:30.999Z"}       | ${"millisecond"} | ${false}
    ${"2024-05-15T10:20:30.123456Z"}    | ${"2024-05-15T10:20:30.123999Z"}    | ${"microsecond"} | ${false}
    ${"2024-05-15T10:20:30.123456789Z"} | ${"2024-05-15T10:20:30.123456788Z"} | ${"nanosecond"}  | ${false}
    ${"2024-05-15T10:20:30.123456Z"}    | ${"2024-05-15T10:20:30.123999Z"}    | ${"millisecond"} | ${true}
    ${"2024-05-15T10:20:30.123Z"}       | ${"2024-05-15T10:20:30.999Z"}       | ${"second"}      | ${true}
  `(
    "returns $expected for $value1 and $value2 by $unit",
    ({ value1, value2, unit, expected }) => {
      expect(areUtcEqualBy(value1, value2, unit)).toBe(expected);
    },
  );

  // `fractionalSecondDigits` was removed in 1.16.0: it was ignored, because equality compares
  // buckets, not printed strings. Passing it is a type error, and a JavaScript caller's stray
  // property changes nothing — two milliseconds that print alike at 0 digits still differ.
  it("treats the removed fractionalSecondDigits option as a type error and ignores it at runtime", () => {
    expect(
      areUtcEqualBy(
        "2024-05-15T10:20:30.123Z",
        "2024-05-15T10:20:30.999Z",
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
      areUtcEqualBy(
        "2024-03-15T00:00:00Z",
        "2024-03-15T00:00:00Z",
        "decade" as never,
      ),
    ).toBe(false);
  });

  it.each`
    value1                    | value2
    ${""}                     | ${""}
    ${null}                   | ${"2024-03-15T00:00:00Z"}
    ${undefined}              | ${"2024-03-15T00:00:00Z"}
    ${"not-a-utc-datetime"}   | ${"2024-03-15T00:00:00Z"}
    ${"2024-03-15T00:00:00Z"} | ${null}
    ${"2024-03-15T00:00:00Z"} | ${undefined}
    ${"2024-03-15T00:00:00Z"} | ${"not-a-utc-datetime"}
  `(
    "returns false for invalid input $value1 and $value2",
    ({ value1, value2 }) => {
      expect(areUtcEqualBy(value1 as never, value2 as never, "month")).toBe(
        false,
      );
    },
  );

  // Temporal §13.17 GetTemporalUnitValuedOption: a plural unit name is the same unit as its singular.
  it.each`
    unit              | value1                              | value2                              | expected
    ${"years"}        | ${"2024-01-01T12:00:00Z"}           | ${"2024-12-31T12:00:00Z"}           | ${true}
    ${"years"}        | ${"2024-12-31T12:00:00Z"}           | ${"2025-01-01T12:00:00Z"}           | ${false}
    ${"months"}       | ${"2024-02-01T12:00:00Z"}           | ${"2024-02-29T12:00:00Z"}           | ${true}
    ${"months"}       | ${"2024-02-29T12:00:00Z"}           | ${"2024-03-01T12:00:00Z"}           | ${false}
    ${"weeks"}        | ${"2024-02-26T12:00:00Z"}           | ${"2024-03-03T12:00:00Z"}           | ${true}
    ${"weeks"}        | ${"2024-03-03T12:00:00Z"}           | ${"2024-03-04T12:00:00Z"}           | ${false}
    ${"days"}         | ${"2024-02-29T12:00:00Z"}           | ${"2024-02-29T12:00:00Z"}           | ${true}
    ${"days"}         | ${"2024-02-29T12:00:00Z"}           | ${"2024-03-01T12:00:00Z"}           | ${false}
    ${"hours"}        | ${"2024-02-29T13:00:00Z"}           | ${"2024-02-29T13:59:59.999999999Z"} | ${true}
    ${"hours"}        | ${"2024-02-29T13:59:59.999999999Z"} | ${"2024-02-29T14:00:00Z"}           | ${false}
    ${"minutes"}      | ${"2024-02-29T13:45:00Z"}           | ${"2024-02-29T13:45:59.999999999Z"} | ${true}
    ${"minutes"}      | ${"2024-02-29T13:45:59.999999999Z"} | ${"2024-02-29T13:46:00Z"}           | ${false}
    ${"seconds"}      | ${"2024-02-29T13:45:30Z"}           | ${"2024-02-29T13:45:30.999999999Z"} | ${true}
    ${"seconds"}      | ${"2024-02-29T13:45:30.999999999Z"} | ${"2024-02-29T13:45:31Z"}           | ${false}
    ${"milliseconds"} | ${"2024-02-29T13:45:30.123Z"}       | ${"2024-02-29T13:45:30.123999999Z"} | ${true}
    ${"milliseconds"} | ${"2024-02-29T13:45:30.123999999Z"} | ${"2024-02-29T13:45:30.124Z"}       | ${false}
    ${"microseconds"} | ${"2024-02-29T13:45:30.123456Z"}    | ${"2024-02-29T13:45:30.123456999Z"} | ${true}
    ${"microseconds"} | ${"2024-02-29T13:45:30.123456999Z"} | ${"2024-02-29T13:45:30.123457Z"}    | ${false}
    ${"nanoseconds"}  | ${"2024-02-29T13:45:30.123456789Z"} | ${"2024-02-29T13:45:30.123456789Z"} | ${true}
    ${"nanoseconds"}  | ${"2024-02-29T13:45:30.123456789Z"} | ${"2024-02-29T13:45:30.12345679Z"}  | ${false}
  `(
    "returns $expected for $value1 and $value2 by plural unit $unit",
    ({ unit, value1, value2, expected }) => {
      expect(areUtcEqualBy(value1, value2, unit)).toBe(expected);
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
        areUtcEqualBy("2024-02-29T13:45:30Z", "2024-02-29T13:45:30Z", unit, {
          weekStartsOn,
        }),
      ).toBe(false);
    },
  );
});
