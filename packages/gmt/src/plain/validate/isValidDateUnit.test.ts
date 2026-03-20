import { isValidDateUnit } from "./isValidDateUnit";

describe("isValidDateUnit", () => {
  it.each`
    unit
    ${"year"}
    ${"month"}
    ${"week"}
    ${"day"}
  `("returns true for valid date unit: $unit", ({ unit }) => {
    expect(isValidDateUnit(unit)).toBe(true);
  });

  it.each`
    invalidUnit
    ${"hour"}
    ${"minute"}
    ${"second"}
    ${"millisecond"}
    ${"not-a-unit"}
    ${""}
    ${1}
    ${0}
    ${true}
    ${false}
    ${null}
    ${undefined}
  `("returns false for invalid date unit: $invalidUnit", ({ invalidUnit }) => {
    expect(isValidDateUnit(invalidUnit)).toBe(false);
  });
});
