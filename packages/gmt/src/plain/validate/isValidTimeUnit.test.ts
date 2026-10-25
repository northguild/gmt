import { isValidTimeUnit } from "./isValidTimeUnit";

describe("isValidTimeUnit", () => {
  it.each`
    unit
    ${"hour"}
    ${"minute"}
    ${"second"}
    ${"millisecond"}
    ${"microsecond"}
    ${"nanosecond"}
  `("returns true for valid time unit: $unit", ({ unit }) => {
    expect(isValidTimeUnit(unit)).toBe(true);
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
  `("returns false for invalid time unit: $label", ({ invalidUnit }) => {
    expect(isValidTimeUnit(invalidUnit)).toBe(false);
  });
});
