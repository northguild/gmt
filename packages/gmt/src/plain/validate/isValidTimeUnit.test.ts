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
    invalidUnit
    ${"year"}
    ${"month"}
    ${"week"}
    ${"day"}
    ${"not-a-unit"}
    ${""}
    ${1}
    ${0}
    ${true}
    ${false}
    ${null}
    ${undefined}
  `("returns false for invalid time unit: $invalidUnit", ({ invalidUnit }) => {
    expect(isValidTimeUnit(invalidUnit)).toBe(false);
  });
});
