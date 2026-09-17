import { isValidUnixUnit } from "./isValidUnixUnit";

describe("isValidUnixUnit", () => {
  // Temporal §13.17: singular and plural unit names are the same unit.
  it.each`
    value             | expected
    ${"seconds"}      | ${true}
    ${"second"}       | ${true}
    ${"milliseconds"} | ${true}
    ${"millisecond"}  | ${true}
    ${"invalid"}      | ${false}
    ${"nanoseconds"}  | ${false}
    ${"Seconds"}      | ${false}
    ${""}             | ${false}
    ${undefined}      | ${false}
    ${null}           | ${false}
    ${123}            | ${false}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(isValidUnixUnit(value)).toBe(expected);
  });
});
