import { endOfUtc } from "./endOfUtc";

describe("endOfUtc", () => {
  it.each`
    value                         | unit             | expected
    ${"2024-02-29T12:34:56Z"}     | ${"year"}        | ${"2024-12-31T23:59:59Z"}
    ${"2024-02-29T12:34:56Z"}     | ${"month"}       | ${"2024-02-29T23:59:59Z"}
    ${"2024-02-29T12:34:56Z"}     | ${"week"}        | ${"2024-03-03T23:59:59Z"}
    ${"2024-02-29T12:34:56Z"}     | ${"day"}         | ${"2024-02-29T23:59:59Z"}
    ${"2024-02-29T12:34:56Z"}     | ${"hour"}        | ${"2024-02-29T12:59:59Z"}
    ${"2024-02-29T12:34:56Z"}     | ${"minute"}      | ${"2024-02-29T12:34:59Z"}
    ${"2024-02-29T12:34:56.123Z"} | ${"millisecond"} | ${"2024-02-29T12:34:56.123Z"}
  `(
    "returns $expected for value $value and unit $unit",
    ({ value, unit, expected }) => {
      expect(endOfUtc(value, unit as never)).toBe(expected);
    },
  );

  it.each`
    value                     | unit      | weekStartsOn | expected
    ${"2024-02-29T12:34:56Z"} | ${"week"} | ${"monday"}  | ${"2024-03-03T23:59:59Z"}
    ${"2024-02-29T12:34:56Z"} | ${"week"} | ${"sunday"}  | ${"2024-03-02T23:59:59Z"}
  `(
    "supports weekStartsOn $weekStartsOn returning $expected for value $value and unit $unit",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(endOfUtc(value, unit as never, { weekStartsOn })).toBe(expected);
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
      expect(endOfUtc(invalidValue as never, "day" as never)).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${""}
    ${null}
    ${undefined}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(endOfUtc("2024-02-29T12:34:56Z", invalidUnit as never)).toBe("");
  });
});
