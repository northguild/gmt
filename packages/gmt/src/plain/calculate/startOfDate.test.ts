import { startOfDate } from "./startOfDate";

describe("startOfDate", () => {
  it.each`
    value           | unit       | expected
    ${"2024-02-29"} | ${"year"}  | ${"2024-01-01"}
    ${"2024-02-29"} | ${"month"} | ${"2024-02-01"}
    ${"2024-02-29"} | ${"week"}  | ${"2024-02-26"}
  `(
    "returns $expected for value $value and unit $unit",
    ({ value, unit, expected }) => {
      expect(startOfDate(value, unit)).toBe(expected);
    },
  );

  // supports weekStart option
  it.each`
    value           | unit      | weekStartsOn | expected
    ${"2024-02-29"} | ${"week"} | ${undefined} | ${"2024-02-26"}
    ${"2024-02-29"} | ${"week"} | ${"monday"}  | ${"2024-02-26"}
    ${"2024-02-29"} | ${"week"} | ${"sunday"}  | ${"2024-02-25"}
  `(
    "returns $expected for value $value, unit $unit, and weekStartsOn $weekStartsOn, defaulting to Sunday",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(startOfDate(value, unit, { weekStartsOn })).toBe(expected);
    },
  );

  // error handling - invalid date
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
    expect(startOfDate(invalidDate, "month")).toBe("");
  });

  // error handling - invalid unit
  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${"dayz"}
    ${"months"}
    ${""}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(startOfDate("2024-02-29", invalidUnit)).toBe("");
  });
});
