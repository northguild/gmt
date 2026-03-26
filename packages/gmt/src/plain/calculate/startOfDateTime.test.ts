import { startOfDateTime } from "./startOfDateTime";

describe("startOfDateTime", () => {
  it.each`
    value                              | unit             | expected
    ${"2024-02-29T12:34:56"}           | ${"year"}        | ${"2024-01-01T00:00:00"}
    ${"2024-02-29T12:34:56"}           | ${"month"}       | ${"2024-02-01T00:00:00"}
    ${"2024-02-29T12:34:56"}           | ${"week"}        | ${"2024-02-26T00:00:00"}
    ${"2024-02-29T12:34:56"}           | ${"day"}         | ${"2024-02-29T00:00:00"}
    ${"2024-02-29T12:34:56"}           | ${"hour"}        | ${"2024-02-29T12:00:00"}
    ${"2024-02-29T12:34:56"}           | ${"minute"}      | ${"2024-02-29T12:34:00"}
    ${"2024-02-29T12:34:56"}           | ${"second"}      | ${"2024-02-29T12:34:56"}
    ${"2024-02-29T12:34:56.999"}       | ${"millisecond"} | ${"2024-02-29T12:34:56.999"}
    ${"2024-02-29T12:34:56.999999"}    | ${"microsecond"} | ${"2024-02-29T12:34:56.999999"}
    ${"2024-02-29T12:34:56.999999999"} | ${"nanosecond"}  | ${"2024-02-29T12:34:56.999999999"}
  `("returns $expected for $value and $unit", ({ value, unit, expected }) => {
    expect(startOfDateTime(value, unit)).toBe(expected);
  });

  // supports weekStartsOn option
  it.each`
    value                    | unit      | weekStartsOn | expected
    ${"2024-02-29T12:34:56"} | ${"week"} | ${undefined} | ${"2024-02-26T00:00:00"}
    ${"2024-02-29T12:34:56"} | ${"week"} | ${"monday"}  | ${"2024-02-26T00:00:00"}
    ${"2024-02-29T12:34:56"} | ${"week"} | ${"sunday"}  | ${"2024-02-25T00:00:00"}
  `(
    "supports weekStartOn $weekStartsOn returning $expected for $value and $unit",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(startOfDateTime(value, unit, { weekStartsOn })).toBe(expected);
    },
  );

  // supports fractionalSecondDigits option
  it.each`
    value                              | unit        | fractionalSecondDigits | expected
    ${"2024-02-29T12:34:56.789"}       | ${"second"} | ${0}                   | ${"2024-02-29T12:34:56"}
    ${"2024-02-29T12:34:56.789"}       | ${"second"} | ${3}                   | ${"2024-02-29T12:34:56.000"}
    ${"2024-02-29T12:34:56.789123"}    | ${"second"} | ${6}                   | ${"2024-02-29T12:34:56.000000"}
    ${"2024-02-29T12:34:56.789123456"} | ${"second"} | ${9}                   | ${"2024-02-29T12:34:56.000000000"}
    ${"2024-02-29T12:34:56.789"}       | ${"second"} | ${undefined}           | ${"2024-02-29T12:34:56"}
  `(
    "supports fractionalSecondDigits $fractionalSecondDigits returning $expected for $value and $unit",
    ({ value, unit, fractionalSecondDigits, expected }) => {
      expect(startOfDateTime(value, unit, { fractionalSecondDigits })).toBe(
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
      expect(startOfDateTime(invalidDateTime, "month")).toBe("");
    },
  );

  // invalid unit
  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${""}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(startOfDateTime("2024-02-29T12:34:56", invalidUnit)).toBe("");
  });
});
