import { isValidDateTimeCycleField } from "./isValidDateTimeCycleField";

describe("isValidDateTimeCycleField", () => {
  it.each`
    field
    ${"year"}
    ${"month"}
    ${"day"}
    ${"hour"}
    ${"minute"}
    ${"second"}
    ${"millisecond"}
    ${"microsecond"}
    ${"nanosecond"}
  `("returns true for $field", ({ field }) => {
    expect(isValidDateTimeCycleField(field)).toBe(true);
  });

  it.each`
    field        | label
    ${"week"}    | ${"'week'"}
    ${"invalid"} | ${"'invalid'"}
    ${""}        | ${"''"}
    ${123}       | ${"123"}
    ${null}      | ${"null"}
    ${undefined} | ${"undefined"}
    ${true}      | ${"true"}
    ${[]}        | ${"[]"}
    ${{}}        | ${"{}"}
  `("returns false for $label", ({ field }) => {
    expect(isValidDateTimeCycleField(field)).toBe(false);
  });
});
