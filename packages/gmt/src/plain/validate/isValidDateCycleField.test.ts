import { isValidDateCycleField } from "./isValidDateCycleField";

describe("isValidDateCycleField", () => {
  it.each`
    field
    ${"year"}
    ${"month"}
    ${"day"}
  `("returns true for $field", ({ field }) => {
    expect(isValidDateCycleField(field)).toBe(true);
  });

  it.each`
    field
    ${"week"}
    ${"hour"}
    ${"invalid"}
    ${""}
    ${123}
    ${null}
    ${undefined}
    ${true}
    ${[]}
    ${{}}
  `("returns false for $field", ({ field }) => {
    expect(isValidDateCycleField(field)).toBe(false);
  });
});
