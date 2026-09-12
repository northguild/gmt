import { isValidZoneBucketUnit } from "./isValidZoneBucketUnit";

describe("isValidZoneBucketUnit", () => {
  it.each`
    unit
    ${"hour"}
    ${"day"}
    ${"week"}
    ${"month"}
  `("returns true for valid zone bucket unit: $unit", ({ unit }) => {
    expect(isValidZoneBucketUnit(unit)).toBe(true);
  });

  it.each`
    invalidUnit  | reason
    ${"year"}    | ${"a calendar year is getQuarter's question"}
    ${"quarter"} | ${"a quarter is getQuarter's question"}
    ${"minute"}  | ${"a sub-hour boundary needs no zone"}
    ${"second"}  | ${"a sub-hour boundary needs no zone"}
    ${"days"}    | ${"plural"}
    ${"Day"}     | ${"wrong case"}
    ${"invalid"} | ${"not a unit at all"}
    ${""}        | ${"empty string"}
  `(
    "returns false for invalid zone bucket unit: $invalidUnit ($reason)",
    ({ invalidUnit }) => {
      expect(isValidZoneBucketUnit(invalidUnit)).toBe(false);
    },
  );

  it.each`
    nonString
    ${1}
    ${0}
    ${true}
    ${false}
    ${null}
    ${undefined}
    ${["day"]}
    ${{ unit: "day" }}
  `("returns false when $nonString is non-string", ({ nonString }) => {
    expect(isValidZoneBucketUnit(nonString)).toBe(false);
  });
});
