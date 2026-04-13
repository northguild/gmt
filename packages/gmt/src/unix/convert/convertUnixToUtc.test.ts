import { convertUnixToUtc } from "./convertUnixToUtc";

describe("convertUnixToUtc", () => {
  it.each`
    value            | unit              | expected
    ${0}             | ${"milliseconds"} | ${"1970-01-01T00:00:00Z"}
    ${0}             | ${"seconds"}      | ${"1970-01-01T00:00:00Z"}
    ${1709164800000} | ${"milliseconds"} | ${"2024-02-29T00:00:00Z"}
    ${1709164800}    | ${"seconds"}      | ${"2024-02-29T00:00:00Z"}
  `("returns $expected for $value in $unit", ({ value, unit, expected }) => {
    expect(convertUnixToUtc(value, unit)).toBe(expected);
  });

  it.each`
    invalidValue
    ${NaN}
    ${Infinity}
    ${-Infinity}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid unix value $invalidValue",
    ({ invalidValue }) => {
      expect(convertUnixToUtc(invalidValue as never)).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"minutes"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid unit $invalidUnit",
    ({ invalidUnit }) => {
      expect(convertUnixToUtc(0, invalidUnit as never)).toBe("");
    },
  );
});
