import { startOfTime } from "./startOfTime";

describe("startOfTime", () => {
  it.each`
    value                   | unit             | expected
    ${"12:34:56"}           | ${"day"}         | ${"00:00:00"}
    ${"12:34:56"}           | ${"hour"}        | ${"12:00:00"}
    ${"12:34:56"}           | ${"minute"}      | ${"12:34:00"}
    ${"12:34:56"}           | ${"second"}      | ${"12:34:56"}
    ${"12:34:56.999"}       | ${"millisecond"} | ${"12:34:56.999"}
    ${"12:34:56.999999"}    | ${"microsecond"} | ${"12:34:56.999999"}
    ${"12:34:56.999999999"} | ${"nanosecond"}  | ${"12:34:56.999999999"}
  `("returns $expected for $value and $unit", ({ value, unit, expected }) => {
    expect(startOfTime(value, unit)).toBe(expected);
  });

  // The start of a unit keeps every larger field and zeroes every smaller one, down to the nanosecond
  // (Temporal round with roundingMode "floor"), whatever precision the output prints.
  it.each`
    value                   | unit             | expected
    ${"12:34:56.123456789"} | ${"day"}         | ${"00:00:00.000000000"}
    ${"12:34:56.123456789"} | ${"hour"}        | ${"12:00:00.000000000"}
    ${"12:34:56.123456789"} | ${"minute"}      | ${"12:34:00.000000000"}
    ${"12:34:56.123456789"} | ${"second"}      | ${"12:34:56.000000000"}
    ${"12:34:56.123456789"} | ${"millisecond"} | ${"12:34:56.123000000"}
    ${"12:34:56.123456789"} | ${"microsecond"} | ${"12:34:56.123456000"}
    ${"12:34:56.123456789"} | ${"nanosecond"}  | ${"12:34:56.123456789"}
  `(
    "returns $expected for $value and $unit at nanosecond precision",
    ({ value, unit, expected }) => {
      expect(startOfTime(value, unit, { fractionalSecondDigits: 9 })).toBe(
        expected,
      );
    },
  );

  it.each`
    nonStringInput
    ${"invalid-time"}
    ${"24:34:56.1234567890"}
    ${"2024-02-29T12:34:56"}
    ${"2024-02-29T12:34:56Z"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `(
    "returns empty string for non-string input $nonStringInput",
    ({ nonStringInput }) => {
      expect(startOfTime(nonStringInput, "hour")).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${"minutez"}
    ${""}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(startOfTime("12:34:56", invalidUnit as never)).toBe("");
  });

  // Temporal §13.17 GetTemporalUnitValuedOption: a plural unit name is the same unit as its singular.
  it.each`
    unit              | expected
    ${"days"}         | ${"00:00:00"}
    ${"hours"}        | ${"13:00:00"}
    ${"minutes"}      | ${"13:45:00"}
    ${"seconds"}      | ${"13:45:30"}
    ${"milliseconds"} | ${"13:45:30.123"}
    ${"microseconds"} | ${"13:45:30.123456"}
    ${"nanoseconds"}  | ${"13:45:30.123456789"}
  `(
    "returns $expected for plural unit $unit on 13:45:30.123456789",
    ({ unit, expected }) => {
      expect(startOfTime("13:45:30.123456789", unit)).toBe(expected);
    },
  );
});
