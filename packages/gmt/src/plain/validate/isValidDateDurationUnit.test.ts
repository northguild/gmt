import { isValidDateDurationUnit } from "./isValidDateDurationUnit";

describe("isValidDateDurationUnit", () => {
  it.each`
    unit
    ${"years"}
    ${"months"}
    ${"weeks"}
    ${"days"}
  `("returns true for valid date duration unit: $unit", ({ unit }) => {
    expect(isValidDateDurationUnit(unit)).toBe(true);
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
    "returns false for invalid date duration unit: $label",
    ({ invalidUnit }) => {
      expect(isValidDateDurationUnit(invalidUnit)).toBe(false);
    },
  );
});
