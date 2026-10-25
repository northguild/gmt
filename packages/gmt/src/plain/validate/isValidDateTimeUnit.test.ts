import { isValidDateTimeUnit } from "./isValidDateTimeUnit";

describe("isValidDateTimeUnit", () => {
  it.each`
    unit
    ${"year"}
    ${"month"}
    ${"week"}
    ${"day"}
    ${"hour"}
    ${"minute"}
    ${"second"}
    ${"millisecond"}
    ${"microsecond"}
    ${"nanosecond"}
  `("returns true for valid date time unit: $unit", ({ unit }) => {
    expect(isValidDateTimeUnit(unit)).toBe(true);
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
  `("returns false for invalid date time unit: $label", ({ invalidUnit }) => {
    expect(isValidDateTimeUnit(invalidUnit)).toBe(false);
  });
});
