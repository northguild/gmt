import { isValidUnixUnit } from "./isValidUnixUnit";

describe("isValidUnixUnit", () => {
  // Temporal §13.17: singular and plural unit names are the same unit.
  it.each`
    value             | expected | label
    ${"seconds"}      | ${true}  | ${"'seconds'"}
    ${"second"}       | ${true}  | ${"'second'"}
    ${"milliseconds"} | ${true}  | ${"'milliseconds'"}
    ${"millisecond"}  | ${true}  | ${"'millisecond'"}
    ${"invalid"}      | ${false} | ${"'invalid'"}
    ${"nanoseconds"}  | ${false} | ${"'nanoseconds'"}
    ${"Seconds"}      | ${false} | ${"'Seconds'"}
    ${""}             | ${false} | ${"''"}
    ${undefined}      | ${false} | ${"undefined"}
    ${null}           | ${false} | ${"null"}
    ${123}            | ${false} | ${"123"}
  `("returns $expected for $label", ({ value, expected }) => {
    expect(isValidUnixUnit(value)).toBe(expected);
  });
});
