import { isValidTimeDurationUnit } from "./isValidTimeDurationUnit";

describe("isValidTimeDurationUnit", () => {
  it.each`
    unit
    ${"hours"}
    ${"minutes"}
    ${"seconds"}
    ${"milliseconds"}
    ${"microseconds"}
    ${"nanoseconds"}
  `("returns true for valid time duration unit: $unit", ({ unit }) => {
    expect(isValidTimeDurationUnit(unit)).toBe(true);
  });

  it.each`
    invalidUnit
    ${"years"}
    ${"months"}
    ${"weeks"}
    ${"days"}
    ${"not-a-unit"}
    ${""}
    ${1}
    ${0}
    ${true}
    ${false}
    ${null}
    ${undefined}
  `(
    "returns false for invalid time duration unit: $invalidUnit",
    ({ invalidUnit }) => {
      expect(isValidTimeDurationUnit(invalidUnit)).toBe(false);
    },
  );
});
