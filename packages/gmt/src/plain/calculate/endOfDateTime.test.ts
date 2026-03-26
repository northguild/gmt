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

  // supports weekStartsOn option
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

  // supports fractionalSecondDigits option
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

  // invalid value
  it.each`
    invalidDateTime
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
    "returns empty string for invalid datetime $invalidDateTime",
    ({ invalidDateTime }) => {
      expect(endOfDateTime(invalidDateTime, "month")).toBe("");
    },
  );

  // invalid unit
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
});
