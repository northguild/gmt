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
    invalidUnit
    ${"not-a-unit"}
    ${""}
    ${1}
    ${0}
    ${true}
    ${false}
    ${null}
    ${undefined}
  `(
    "returns false for invalid date duration unit: $invalidUnit",
    ({ invalidUnit }) => {
      expect(isValidDateDurationUnit(invalidUnit)).toBe(false);
    },
  );
});
