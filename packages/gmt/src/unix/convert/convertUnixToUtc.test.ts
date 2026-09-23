import { convertUnixToUtc } from "./convertUnixToUtc";

describe("convertUnixToUtc", () => {
  it.each`
    value            | unit              | expected
    ${0}             | ${"milliseconds"} | ${"1970-01-01T00:00:00Z"}
    ${0}             | ${"seconds"}      | ${"1970-01-01T00:00:00Z"}
    ${1709164800000} | ${"milliseconds"} | ${"2024-02-29T00:00:00Z"}
    ${1709164800}    | ${"seconds"}      | ${"2024-02-29T00:00:00Z"}
  `("returns $expected for $value in $unit", ({ value, unit, expected }) => {
    expect(convertUnixToUtc(value, { epochUnit: unit })).toBe(expected);
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
  `(
    "returns an empty string for invalid unit $invalidUnit",
    ({ invalidUnit }) => {
      expect(convertUnixToUtc(0, { epochUnit: invalidUnit as never })).toBe("");
    },
  );

  // 1709164800 s is 2024-02-29T00:00:00Z; singular and plural are the same unit (Temporal §13.17).
  it.each`
    options                         | expected
    ${undefined}                    | ${"1970-01-20T18:46:04.8Z"}
    ${{ epochUnit: undefined }}     | ${"1970-01-20T18:46:04.8Z"}
    ${{ epochUnit: "millisecond" }} | ${"1970-01-20T18:46:04.8Z"}
    ${{ epochUnit: "second" }}      | ${"2024-02-29T00:00:00Z"}
    ${{ epochUnit: "seconds" }}     | ${"2024-02-29T00:00:00Z"}
  `(
    "returns $expected for 1709164800 with options $options",
    ({ options, expected }) => {
      expect(convertUnixToUtc(1709164800, options)).toBe(expected);
    },
  );

  it("reads explicit undefined options as omitted", () => {
    expect(convertUnixToUtc(0, undefined)).toBe("1970-01-01T00:00:00Z");
  });

  // The unit is an options object; a legacy positional unit string (or null) is not an options
  // object (Temporal GetOptionsObject throws TypeError), so it is the sentinel, never a silent
  // default. An explicit undefined is the same as omitted.
  it.each`
    options
    ${"seconds"}
    ${"milliseconds"}
    ${null}
    ${1000}
  `("returns the sentinel for non-object options $options", ({ options }) => {
    expect(convertUnixToUtc(1709164800, options as never)).toBe("");
  });
});

describe("convertUnixToUtc invalid-input @example", () => {
  it('returns "" for convertUnixToUtc(NaN)', () => {
    expect(convertUnixToUtc(NaN)).toBe("");
  });
});
