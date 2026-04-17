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
    invalidUnit
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
    ${"not-a-unit"}
    ${""}
    ${1}
    ${0}
    ${true}
    ${false}
    ${null}
    ${undefined}
  `(
    "returns false for invalid date time unit: $invalidUnit",
    ({ invalidUnit }) => {
      expect(isValidDateTimeUnit(invalidUnit)).toBe(false);
    },
  );
});
