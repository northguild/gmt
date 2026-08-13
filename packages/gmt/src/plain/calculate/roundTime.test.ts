import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";
import { roundTime } from "./roundTime";

describe("roundTime", () => {
  it.each`
    value                   | unit             | expected
    ${"12:34:56"}           | ${"hour"}        | ${"13:00:00"}
    ${"12:34:56"}           | ${"minute"}      | ${"12:35:00"}
    ${"12:34:56"}           | ${"second"}      | ${"12:34:56"}
    ${"12:34:56.789"}       | ${"millisecond"} | ${"12:34:56.789"}
    ${"12:34:56.789123"}    | ${"microsecond"} | ${"12:34:56.789123"}
    ${"12:34:56.789123456"} | ${"nanosecond"}  | ${"12:34:56.789123456"}
  `(
    "returns $expected for $value rounded to $unit",
    ({ value, unit, expected }) => {
      expect(roundTime(value, { smallestUnit: unit })).toBe(expected);
    },
  );

  it.each`
    value                   | unit             | roundingMode | expected
    ${"12:34:56"}           | ${"hour"}        | ${"floor"}   | ${"12:00:00"}
    ${"12:34:56"}           | ${"hour"}        | ${"ceil"}    | ${"13:00:00"}
    ${"12:34:56"}           | ${"hour"}        | ${"expand"}  | ${"13:00:00"}
    ${"12:34:56"}           | ${"hour"}        | ${"trunc"}   | ${"12:00:00"}
    ${"12:34:56"}           | ${"minute"}      | ${"floor"}   | ${"12:34:00"}
    ${"12:34:56"}           | ${"minute"}      | ${"ceil"}    | ${"12:35:00"}
    ${"12:34:56.789"}       | ${"second"}      | ${"floor"}   | ${"12:34:56"}
    ${"12:34:56.789"}       | ${"second"}      | ${"ceil"}    | ${"12:34:57"}
    ${"12:34:56.123456789"} | ${"millisecond"} | ${"floor"}   | ${"12:34:56.123"}
    ${"12:34:56.123456789"} | ${"millisecond"} | ${"ceil"}    | ${"12:34:56.124"}
  `(
    "returns $expected for $value with roundingMode $roundingMode on $unit",
    ({ value, unit, roundingMode, expected }) => {
      expect(roundTime(value, { smallestUnit: unit, roundingMode })).toBe(
        expected,
      );
    },
  );

  it.each`
    value         | unit        | roundingIncrement | expected
    ${"12:34:56"} | ${"minute"} | ${15}             | ${"12:30:00"}
    ${"12:34:56"} | ${"minute"} | ${30}             | ${"12:30:00"}
    ${"12:34:56"} | ${"hour"}   | ${2}              | ${"12:00:00"}
    ${"23:59:59"} | ${"hour"}   | ${2}              | ${"00:00:00"}
  `(
    "returns $expected for $value with roundingIncrement $roundingIncrement on $unit",
    ({ value, unit, roundingIncrement, expected }) => {
      expect(roundTime(value, { smallestUnit: unit, roundingIncrement })).toBe(
        expected,
      );
    },
  );

  it.each`
    value         | unit        | roundingIncrement
    ${"12:34:56"} | ${"minute"} | ${0}
    ${"12:34:56"} | ${"hour"}   | ${-1}
    ${"12:34:56"} | ${"second"} | ${0}
  `(
    "returns empty string for $value with roundingIncrement $roundingIncrement on $unit",
    ({ value, unit, roundingIncrement }) => {
      expect(roundTime(value, { smallestUnit: unit, roundingIncrement })).toBe(
        "",
      );
    },
  );

  it.each`
    value                   | unit             | roundingMode    | expected
    ${"12:30:00"}           | ${"minute"}      | ${"halfExpand"} | ${"12:30:00"}
    ${"12:30:00"}           | ${"minute"}      | ${"halfTrunc"}  | ${"12:30:00"}
    ${"00:00:00"}           | ${"hour"}        | ${"halfExpand"} | ${"00:00:00"}
    ${"23:59:59"}           | ${"hour"}        | ${"halfExpand"} | ${"00:00:00"}
    ${"12:34:56.123456789"} | ${"millisecond"} | ${"halfExpand"} | ${"12:34:56.123"}
    ${"12:34:56.123456789"} | ${"millisecond"} | ${"halfCeil"}   | ${"12:34:56.123"}
    ${"12:34:56.123456789"} | ${"millisecond"} | ${"halfTrunc"}  | ${"12:34:56.123"}
    ${"12:34:56.123456789"} | ${"millisecond"} | ${"halfFloor"}  | ${"12:34:56.123"}
    ${"12:34:56.123456789"} | ${"microsecond"} | ${"halfExpand"} | ${"12:34:56.123457"}
    ${"12:34:56.123456789"} | ${"microsecond"} | ${"halfCeil"}   | ${"12:34:56.123457"}
    ${"12:34:56.123456789"} | ${"microsecond"} | ${"halfTrunc"}  | ${"12:34:56.123457"}
    ${"12:34:56.123456789"} | ${"microsecond"} | ${"halfFloor"}  | ${"12:34:56.123457"}
    ${"12:34:56.123456789"} | ${"nanosecond"}  | ${"halfExpand"} | ${"12:34:56.123456789"}
  `(
    "returns $expected for boundary $value with roundingMode $roundingMode on $unit",
    ({ value, unit, roundingMode, expected }) => {
      expect(roundTime(value, { smallestUnit: unit, roundingMode })).toBe(
        expected,
      );
    },
  );

  it.each`
    nonStringInput
    ${"invalid-time"}
    ${"24:34:56"}
    ${"12:60:00"}
    ${"12:34:60"}
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
      expect(roundTime(nonStringInput, { smallestUnit: "hour" })).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${"year"}
    ${"month"}
    ${"week"}
    ${"day"}
    ${"hours"}
    ${"minutez"}
    ${""}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(roundTime("12:34:56", { smallestUnit: invalidUnit as never })).toBe(
      "",
    );
  });

  it.each`
    value         | unit        | roundingIncrement
    ${"12:34:56"} | ${"minute"} | ${7}
    ${"12:34:56"} | ${"second"} | ${7}
  `(
    "returns empty string for invalid roundingIncrement $roundingIncrement on $unit",
    ({ value, unit, roundingIncrement }) => {
      expect(roundTime(value, { smallestUnit: unit, roundingIncrement })).toBe(
        "",
      );
    },
  );

  it("returns empty string when Temporal.PlainTime.from throws", () => {
    mockTemporalPlainTimeFromThrow();
    expect(roundTime("12:34:56", { smallestUnit: "hour" })).toBe("");
  });
});
