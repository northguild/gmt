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
    field        | label
    ${"week"}    | ${"'week'"}
    ${"hour"}    | ${"'hour'"}
    ${"invalid"} | ${"'invalid'"}
    ${""}        | ${"''"}
    ${123}       | ${"123"}
    ${null}      | ${"null"}
    ${undefined} | ${"undefined"}
    ${true}      | ${"true"}
    ${[]}        | ${"[]"}
    ${{}}        | ${"{}"}
  `("returns false for $label", ({ field }) => {
    expect(isValidDateCycleField(field)).toBe(false);
  });
});
