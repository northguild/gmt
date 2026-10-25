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
    invalidUnit     | label
    ${"not-a-unit"} | ${"'not-a-unit'"}
    ${""}           | ${"''"}
    ${1}            | ${"1"}
    ${0}            | ${"0"}
    ${true}         | ${"true"}
    ${false}        | ${"false"}
    ${null}         | ${"null"}
    ${undefined}    | ${"undefined"}
  `("returns false for invalid date unit: $label", ({ invalidUnit }) => {
    expect(isValidDateUnit(invalidUnit)).toBe(false);
  });
});
