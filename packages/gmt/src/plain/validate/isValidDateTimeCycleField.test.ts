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
    field
    ${"week"}
    ${"invalid"}
    ${""}
    ${123}
    ${null}
    ${undefined}
    ${true}
    ${[]}
    ${{}}
  `("returns false for $field", ({ field }) => {
    expect(isValidDateTimeCycleField(field)).toBe(false);
  });
});
