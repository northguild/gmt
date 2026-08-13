import { isValidUnixUnit } from "./isValidUnixUnit";

describe("isValidUnixUnit", () => {
  it.each`
    value             | expected
    ${"seconds"}      | ${true}
    ${"milliseconds"} | ${true}
    ${"invalid"}      | ${false}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(isValidUnixUnit(value)).toBe(expected);
  });
});
