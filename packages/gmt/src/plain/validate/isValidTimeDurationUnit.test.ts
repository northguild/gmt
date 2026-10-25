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
    "returns false for invalid time duration unit: $label",
    ({ invalidUnit }) => {
      expect(isValidTimeDurationUnit(invalidUnit)).toBe(false);
    },
  );
});
