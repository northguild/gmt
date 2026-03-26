import { endOfDate } from "./endOfDate";

describe("endOfDate", () => {
  it.each`
    value           | unit       | expected
    ${"2024-02-29"} | ${"year"}  | ${"2024-12-31"}
    ${"2024-02-29"} | ${"month"} | ${"2024-02-29"}
    ${"2024-02-29"} | ${"week"}  | ${"2024-03-03"}
    ${"2024-02-29"} | ${"day"}   | ${"2024-02-29"}
  `("returns $expected for $value and $unit", ({ value, unit, expected }) => {
    expect(endOfDate(value, unit)).toBe(expected);
  });

  // supports weekStartsOn option
  it.each`
    value           | unit      | weekStartsOn | expected
    ${"2024-02-29"} | ${"week"} | ${undefined} | ${"2024-03-03"}
    ${"2024-02-29"} | ${"week"} | ${"monday"}  | ${"2024-03-03"}
    ${"2024-02-29"} | ${"week"} | ${"sunday"}  | ${"2024-03-02"}
  `(
    "returns $expected for $value, $unit, and weekStartsOn $weekStartsOn, defaulting to Monday",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(endOfDate(value, unit, { weekStartsOn })).toBe(expected);
    },
  );

  // invalid value
  it.each`
    invalidDate
    ${"invalid-date"}
    ${"2024-02-30"}
    ${"2024-02-29T00:00:00"}
    ${"2024-02-29T00:00:00Z"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns empty string for invalid date $invalidDate", ({ invalidDate }) => {
    expect(endOfDate(invalidDate, "month")).toBe("");
  });

  // invalid unit
  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${"decade"}
    ${"century"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(endOfDate("2024-02-29", invalidUnit as never)).toBe("");
  });
});
