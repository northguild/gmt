import { startOfTime } from "./startOfTime";

describe("startOfTime", () => {
  it.each`
    value                   | unit             | expected
    ${"12:34:56"}           | ${"day"}         | ${"00:00:00"}
    ${"12:34:56"}           | ${"hour"}        | ${"12:00:00"}
    ${"12:34:56"}           | ${"minute"}      | ${"12:34:00"}
    ${"12:34:56"}           | ${"second"}      | ${"12:34:56"}
    ${"12:34:56.999"}       | ${"millisecond"} | ${"12:34:56.000"}
    ${"12:34:56.999999"}    | ${"microsecond"} | ${"12:34:56.999000"}
    ${"12:34:56.999999999"} | ${"nanosecond"}  | ${"12:34:56.999999000"}
  `("returns $expected for $value and $unit", ({ value, unit, expected }) => {
    expect(startOfTime(value, unit)).toBe(expected);
  });

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
    expect(startOfTime(invalidTime, "hour")).toBe("");
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
    expect(startOfTime("12:34:56", invalidUnit)).toBe("");
  });
});
