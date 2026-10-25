import { isValidDateTimeDurationUnit } from "./isValidDateTimeDurationUnit";

describe("isValidDateTimeDurationUnit", () => {
  it.each`
    unit
    ${"years"}
    ${"months"}
    ${"weeks"}
    ${"days"}
    ${"hours"}
    ${"minutes"}
    ${"seconds"}
    ${"milliseconds"}
    ${"microseconds"}
    ${"nanoseconds"}
  `("returns true for valid date time duration unit: $unit", ({ unit }) => {
    expect(isValidDateTimeDurationUnit(unit)).toBe(true);
  });

  it.each`
    invalidUnit     | label
    ${"not-a-unit"} | ${"'not-a-unit'"}
    ${""}           | ${"''"}
    ${1}            | ${"1"}
    ${0}            | ${"0"}
    ${true}         | ${"true"}
    ${false}        | ${"false"}
    ${null}         | ${"null"}
    ${undefined}    | ${"undefined"}
  `(
    "returns false for invalid date time duration unit: $label",
    ({ invalidUnit }) => {
      expect(isValidDateTimeDurationUnit(invalidUnit)).toBe(false);
    },
  );
});
