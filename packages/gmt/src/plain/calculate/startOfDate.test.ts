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

  // A PlainDate is already a whole day, so its day start is the date itself (as endOfDate's end is).
  it.each`
    value              | unit     | expected
    ${"2024-02-29"}    | ${"day"} | ${"2024-02-29"}
    ${"-271821-04-19"} | ${"day"} | ${"-271821-04-19"}
    ${"+275760-09-13"} | ${"day"} | ${"+275760-09-13"}
  `(
    "returns $expected (the date itself) for value $value and unit $unit",
    ({ value, unit, expected }) => {
      expect(startOfDate(value, unit)).toBe(expected);
    },
  );

  it.each`
    value           | unit      | weekStartsOn | expected
    ${"2024-02-29"} | ${"week"} | ${undefined} | ${"2024-02-26"}
    ${"2024-02-29"} | ${"week"} | ${"monday"}  | ${"2024-02-26"}
    ${"2024-02-29"} | ${"week"} | ${"sunday"}  | ${"2024-02-25"}
  `(
    "returns $expected for value $value, unit $unit, and weekStartsOn $weekStartsOn",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(startOfDate(value, unit, { weekStartsOn })).toBe(expected);
    },
  );

  it.each`
    nonStringInput
    ${"invalid-date"}
    ${"2024-02-30"}
    ${"2024-02-29T00:00:00"}
    ${"2024-02-29T00:00:00Z"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `(
    "returns empty string for non-string input $nonStringInput",
    ({ nonStringInput }) => {
      expect(startOfDate(nonStringInput, "month")).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${"dayz"}
    ${""}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns empty string for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(startOfDate("2024-02-29", invalidUnit as never)).toBe("");
  });

  // Temporal §13.17 GetTemporalUnitValuedOption: a plural unit name is the same unit as its singular.
  it.each`
    unit        | expected
    ${"years"}  | ${"2024-01-01"}
    ${"months"} | ${"2024-02-01"}
    ${"weeks"}  | ${"2024-02-26"}
    ${"days"}   | ${"2024-02-29"}
  `(
    "returns $expected for plural unit $unit on 2024-02-29",
    ({ unit, expected }) => {
      expect(startOfDate("2024-02-29", unit)).toBe(expected);
    },
  );

  // weekStartsOn only names "monday" or "sunday"; any other value is invalid input, for every unit
  // (Temporal GetOption rejects a value outside its allowed list; undefined means the default).
  it.each`
    unit      | weekStartsOn
    ${"week"} | ${"tuesday"}
    ${"week"} | ${"Monday"}
    ${"week"} | ${""}
    ${"week"} | ${null}
    ${"week"} | ${1}
    ${"week"} | ${true}
    ${"day"}  | ${"tuesday"}
    ${"day"}  | ${"Monday"}
    ${"day"}  | ${""}
    ${"day"}  | ${null}
    ${"day"}  | ${1}
    ${"day"}  | ${true}
  `(
    "returns an empty string for unit $unit with invalid weekStartsOn $weekStartsOn",
    ({ unit, weekStartsOn }) => {
      expect(startOfDate("2024-02-29", unit, { weekStartsOn })).toBe("");
    },
  );
});
