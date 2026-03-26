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
    "returns false for invalid date time duration unit: $invalidUnit",
    ({ invalidUnit }) => {
      expect(isValidDateTimeDurationUnit(invalidUnit)).toBe(false);
    },
  );
});
