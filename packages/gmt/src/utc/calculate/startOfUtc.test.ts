import { startOfUtc } from "./startOfUtc";

describe("startOfUtc", () => {
  it.each`
    value                         | unit             | expected
    ${"2024-02-29T12:34:56Z"}     | ${"year"}        | ${"2024-01-01T00:00:00Z"}
    ${"2024-02-29T12:34:56Z"}     | ${"month"}       | ${"2024-02-01T00:00:00Z"}
    ${"2024-02-29T12:34:56Z"}     | ${"week"}        | ${"2024-02-26T00:00:00Z"}
    ${"2024-02-29T12:34:56Z"}     | ${"day"}         | ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T12:34:56Z"}     | ${"hour"}        | ${"2024-02-29T12:00:00Z"}
    ${"2024-02-29T12:34:56Z"}     | ${"minute"}      | ${"2024-02-29T12:34:00Z"}
    ${"2024-02-29T12:34:56Z"}     | ${"second"}      | ${"2024-02-29T12:34:56Z"}
    ${"2024-02-29T12:34:56.123Z"} | ${"millisecond"} | ${"2024-02-29T12:34:56.123Z"}
  `(
    "returns $expected for value $value and unit $unit",
    ({ value, unit, expected }) => {
      expect(startOfUtc(value, unit as never)).toBe(expected);
    },
  );

  it.each`
    value                     | unit      | weekStartsOn | expected
    ${"2024-02-29T12:34:56Z"} | ${"week"} | ${"monday"}  | ${"2024-02-26T00:00:00Z"}
    ${"2024-02-29T12:34:56Z"} | ${"week"} | ${"sunday"}  | ${"2024-02-25T00:00:00Z"}
  `(
    "supports weekStartsOn $weekStartsOn returning $expected for value $value and unit $unit",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(startOfUtc(value, unit as never, { weekStartsOn })).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"invalid"}
    ${"2024-02-29T12:34:56"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns empty string for invalid value $invalidValue",
    ({ invalidValue }) => {
      expect(startOfUtc(invalidValue as never, "day" as never)).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${""}
    ${null}
    ${undefined}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(startOfUtc("2024-02-29T12:34:56Z", invalidUnit as never)).toBe("");
  });
});
