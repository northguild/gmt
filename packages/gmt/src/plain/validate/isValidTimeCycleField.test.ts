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
    field
    ${"year"}
    ${"month"}
    ${"day"}
    ${"invalid"}
    ${""}
    ${123}
    ${null}
    ${undefined}
    ${true}
    ${[]}
    ${{}}
  `("returns false for $field", ({ field }) => {
    expect(isValidTimeCycleField(field)).toBe(false);
  });
});
