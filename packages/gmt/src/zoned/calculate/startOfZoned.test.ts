import { startOfZoned } from "./startOfZoned";

describe("startOfZoned", () => {
  it.each`
    value                                         | unit             | expected
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"year"}        | ${"2024-01-01T00:00:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"month"}       | ${"2024-02-01T00:00:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"week"}        | ${"2024-02-26T00:00:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"day"}         | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"hour"}        | ${"2024-02-29T12:00:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"minute"}      | ${"2024-02-29T12:34:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"}           | ${"second"}      | ${"2024-02-29T12:34:56+00:00[UTC]"}
    ${"2024-02-29T12:34:56.999+00:00[UTC]"}       | ${"millisecond"} | ${"2024-02-29T12:34:56.999+00:00[UTC]"}
    ${"2024-02-29T12:34:56.999999+00:00[UTC]"}    | ${"microsecond"} | ${"2024-02-29T12:34:56.999999+00:00[UTC]"}
    ${"2024-02-29T12:34:56.999999999+00:00[UTC]"} | ${"nanosecond"}  | ${"2024-02-29T12:34:56.999999999+00:00[UTC]"}
  `(
    "returns $expected for value $value and unit $unit",
    ({ value, unit, expected }) => {
      expect(startOfZoned(value, unit)).toBe(expected);
    },
  );

  // supports weekStartsOn option
  it.each`
    value                               | unit      | weekStartsOn | expected
    ${"2024-02-29T12:34:56+00:00[UTC]"} | ${"week"} | ${undefined} | ${"2024-02-26T00:00:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"} | ${"week"} | ${"monday"}  | ${"2024-02-26T00:00:00+00:00[UTC]"}
    ${"2024-02-29T12:34:56+00:00[UTC]"} | ${"week"} | ${"sunday"}  | ${"2024-02-25T00:00:00+00:00[UTC]"}
  `(
    "returns $expected for $value, $unit, and weekStartsOn $weekStartsOn, defaulting to Monday",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(startOfZoned(value, unit, { weekStartsOn })).toBe(expected);
    },
  );

  // supports fractionalSecondDigits option
  it.each`
    value                                         | unit        | fractionalSecondDigits | expected
    ${"2024-02-29T12:34:56.789+00:00[UTC]"}       | ${"second"} | ${0}                   | ${"2024-02-29T12:34:56+00:00[UTC]"}
    ${"2024-02-29T12:34:56.789+00:00[UTC]"}       | ${"second"} | ${3}                   | ${"2024-02-29T12:34:56.000+00:00[UTC]"}
    ${"2024-02-29T12:34:56.789123+00:00[UTC]"}    | ${"second"} | ${6}                   | ${"2024-02-29T12:34:56.000000+00:00[UTC]"}
    ${"2024-02-29T12:34:56.789123456+00:00[UTC]"} | ${"second"} | ${9}                   | ${"2024-02-29T12:34:56.000000000+00:00[UTC]"}
    ${"2024-02-29T12:34:56.789+00:00[UTC]"}       | ${"second"} | ${undefined}           | ${"2024-02-29T12:34:56+00:00[UTC]"}
  `(
    "returns $expected for $value, $unit, and fractionalSecondDigits $fractionalSecondDigits",
    ({ value, unit, fractionalSecondDigits, expected }) => {
      expect(startOfZoned(value, unit, { fractionalSecondDigits })).toBe(
        expected,
      );
    },
  );

  // invalid value
  it.each`
    invalidZonedDateTime
    ${"invalid-zoned-datetime"}
    ${"2024-02-30T12:34:56+00:00[UTC]"}
    ${"2024-02-29T24:00:00+00:00[UTC]"}
    ${"2024-02-29T12:60:00+00:00[UTC]"}
    ${"2024-02-29T12:34:60+00:00[UTC]"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `(
    "returns empty string for invalid zoned datetime $invalidZonedDateTime",
    ({ invalidZonedDateTime }) => {
      expect(startOfZoned(invalidZonedDateTime, "month")).toBe("");
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
    expect(startOfZoned("2024-02-29T12:34:56+00:00[UTC]", invalidUnit)).toBe(
      "",
    );
  });
});
