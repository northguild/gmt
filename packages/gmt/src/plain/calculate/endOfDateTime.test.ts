import { endOfDateTime } from "./endOfDateTime";

describe("endOfDateTime", () => {
  it.each`
    value                              | unit             | expected
    ${"2024-02-29T12:34:56"}           | ${"year"}        | ${"2024-12-31T23:59:59"}
    ${"2024-02-29T12:34:56"}           | ${"month"}       | ${"2024-02-29T23:59:59"}
    ${"2024-02-29T12:34:56"}           | ${"week"}        | ${"2024-03-03T23:59:59"}
    ${"2024-02-29T12:34:56"}           | ${"day"}         | ${"2024-02-29T23:59:59"}
    ${"2024-02-29T12:34:56"}           | ${"hour"}        | ${"2024-02-29T12:59:59"}
    ${"2024-02-29T12:34:56"}           | ${"minute"}      | ${"2024-02-29T12:34:59"}
    ${"2024-02-29T12:34:56"}           | ${"second"}      | ${"2024-02-29T12:34:56"}
    ${"2024-02-29T12:34:56.999"}       | ${"millisecond"} | ${"2024-02-29T12:34:56.999"}
    ${"2024-02-29T12:34:56.999999"}    | ${"microsecond"} | ${"2024-02-29T12:34:56.999999"}
    ${"2024-02-29T12:34:56.999999999"} | ${"nanosecond"}  | ${"2024-02-29T12:34:56.999999999"}
  `("returns $expected for $value and $unit", ({ value, unit, expected }) => {
    expect(endOfDateTime(value, unit)).toBe(expected);
  });

  it.each`
    value                    | unit      | weekStartsOn | expected
    ${"2024-02-29T12:34:56"} | ${"week"} | ${undefined} | ${"2024-03-03T23:59:59"}
    ${"2024-02-29T12:34:56"} | ${"week"} | ${"monday"}  | ${"2024-03-03T23:59:59"}
    ${"2024-02-29T12:34:56"} | ${"week"} | ${"sunday"}  | ${"2024-03-02T23:59:59"}
  `(
    "returns $expected for $value, $unit, weekStartsOn $weekStartsOn, defaulting to Monday",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(endOfDateTime(value, unit, { weekStartsOn })).toBe(expected);
    },
  );

  it.each`
    value                              | unit        | fractionalSecondDigits | expected
    ${"2024-02-29T12:34:56.123456789"} | ${"second"} | ${0}                   | ${"2024-02-29T12:34:56"}
    ${"2024-02-29T12:34:56.123456789"} | ${"second"} | ${3}                   | ${"2024-02-29T12:34:56.999"}
    ${"2024-02-29T12:34:56.123456789"} | ${"second"} | ${6}                   | ${"2024-02-29T12:34:56.999999"}
    ${"2024-02-29T12:34:56.123456789"} | ${"second"} | ${9}                   | ${"2024-02-29T12:34:56.999999999"}
  `(
    "returns $expected for $value, $unit, fractionalSecondDigits $fractionalSecondDigits",
    ({ value, unit, fractionalSecondDigits, expected }) => {
      expect(endOfDateTime(value, unit, { fractionalSecondDigits })).toBe(
        expected,
      );
    },
  );

  it.each`
    nonStringInput
    ${"invalid-datetime"}
    ${"2024-02-30T12:34:56"}
    ${"2024-02-29T24:00:00"}
    ${"2024-02-29T12:60:00"}
    ${"2024-02-29T12:34:60"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `(
    "returns empty string for non-string input $nonStringInput",
    ({ nonStringInput }) => {
      expect(endOfDateTime(nonStringInput, "month")).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${"decade"}
    ${"century"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(endOfDateTime("2024-02-29T12:34:56", invalidUnit as never)).toBe("");
  });

  // A Sunday starts its own Sunday-first week, which ends the following Saturday (+6 days).
  it.each`
    value                    | weekStartsOn | expected                 | description
    ${"2024-03-03T12:00:00"} | ${"sunday"}  | ${"2024-03-09T23:59:59"} | ${"a Sunday starts its own Sunday-first week"}
    ${"2024-03-09T12:00:00"} | ${"sunday"}  | ${"2024-03-09T23:59:59"} | ${"a Saturday ends it"}
    ${"2024-03-03T12:00:00"} | ${"monday"}  | ${"2024-03-03T23:59:59"} | ${"a Sunday ends a Monday-first week"}
  `(
    "returns $expected as the week end of $value with weekStartsOn $weekStartsOn ($description)",
    ({ value, weekStartsOn, expected }) => {
      expect(endOfDateTime(value, "week", { weekStartsOn })).toBe(expected);
    },
  );

  // -271821-04-19 is the first representable date (a Monday; the first PlainDateTime is
  // T00:00:00.000000001). The start of its month, year and Sunday-first week lies before the range,
  // but every end is representable and must be returned.
  it.each`
    value                       | unit       | weekStartsOn | expected
    ${"-271821-04-19T12:00:00"} | ${"day"}   | ${undefined} | ${"-271821-04-19T23:59:59"}
    ${"-271821-04-19T12:00:00"} | ${"week"}  | ${"monday"}  | ${"-271821-04-25T23:59:59"}
    ${"-271821-04-19T12:00:00"} | ${"week"}  | ${"sunday"}  | ${"-271821-04-24T23:59:59"}
    ${"-271821-04-19T12:00:00"} | ${"month"} | ${undefined} | ${"-271821-04-30T23:59:59"}
    ${"-271821-04-19T12:00:00"} | ${"year"}  | ${undefined} | ${"-271821-12-31T23:59:59"}
  `(
    "returns $expected as the $unit end of the first-day value $value (weekStartsOn $weekStartsOn)",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(endOfDateTime(value, unit, { weekStartsOn })).toBe(expected);
    },
  );
});
