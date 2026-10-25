import { isValidTimeCycleField } from "./isValidTimeCycleField";

describe("isValidTimeCycleField", () => {
  it.each`
    field
    ${"hour"}
    ${"minute"}
    ${"second"}
    ${"millisecond"}
    ${"microsecond"}
    ${"nanosecond"}
  `("returns true for $field", ({ field }) => {
    expect(isValidTimeCycleField(field)).toBe(true);
  });

  it.each`
    field        | label
    ${"year"}    | ${"'year'"}
    ${"month"}   | ${"'month'"}
    ${"day"}     | ${"'day'"}
    ${"invalid"} | ${"'invalid'"}
    ${""}        | ${"''"}
    ${123}       | ${"123"}
    ${null}      | ${"null"}
    ${undefined} | ${"undefined"}
    ${true}      | ${"true"}
    ${[]}        | ${"[]"}
    ${{}}        | ${"{}"}
  `("returns false for $label", ({ field }) => {
    expect(isValidTimeCycleField(field)).toBe(false);
  });
});
