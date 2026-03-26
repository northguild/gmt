import { endOfTime } from "./endOfTime";

describe("endOfTime", () => {
  it.each`
    value                   | unit             | expected
    ${"12:34:56"}           | ${"day"}         | ${"23:59:59"}
    ${"12:34:56"}           | ${"hour"}        | ${"12:59:59"}
    ${"12:34:56"}           | ${"minute"}      | ${"12:34:59"}
    ${"12:34:56"}           | ${"second"}      | ${"12:34:56"}
    ${"12:34:56.999"}       | ${"millisecond"} | ${"12:34:56.999"}
    ${"12:34:56.999999"}    | ${"microsecond"} | ${"12:34:56.999999"}
    ${"12:34:56.999999999"} | ${"nanosecond"}  | ${"12:34:56.999999999"}
  `("returns $expected for $value and $unit", ({ value, unit, expected }) => {
    expect(endOfTime(value, unit)).toBe(expected);
  });

  // supports fractionalSecondDigits option
  it.each`
    value                   | unit        | fractionalSecondDigits | expected
    ${"12:34:56.123456789"} | ${"second"} | ${0}                   | ${"12:34:56"}
    ${"12:34:56.123456789"} | ${"second"} | ${3}                   | ${"12:34:56.999"}
    ${"12:34:56.123456789"} | ${"second"} | ${6}                   | ${"12:34:56.999999"}
    ${"12:34:56.123456789"} | ${"second"} | ${9}                   | ${"12:34:56.999999999"}
  `(
    "returns $expected for $value, $unit, fractionalSecondDigits $fractionalSecondDigits",
    ({ value, unit, fractionalSecondDigits, expected }) => {
      expect(endOfTime(value, unit, { fractionalSecondDigits })).toBe(expected);
    },
  );

  // invalid plain time
  it.each`
    invalidTime
    ${"invalid-time"}
    ${"24:34:56.1234567890"}
    ${"2024-02-29T12:34:56"}
    ${"2024-02-29T12:34:56Z"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns empty string for invalid time $invalidTime", ({ invalidTime }) => {
    expect(endOfTime(invalidTime, "hour")).toBe("");
  });

  // invalid unit
  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${"hours"}
    ${"minutez"}
    ${""}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(endOfTime("12:34:56", invalidUnit)).toBe("");
  });
});
