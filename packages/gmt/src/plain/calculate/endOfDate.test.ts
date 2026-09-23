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
      expect(endOfDate(nonStringInput, "month")).toBe("");
    },
  );

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

  // A Sunday starts its own Sunday-first week, which ends the following Saturday (+6 days).
  it.each`
    value           | weekStartsOn | expected        | description
    ${"2024-03-03"} | ${"sunday"}  | ${"2024-03-09"} | ${"a Sunday starts its own Sunday-first week"}
    ${"2024-03-09"} | ${"sunday"}  | ${"2024-03-09"} | ${"a Saturday ends it"}
    ${"2024-03-03"} | ${"monday"}  | ${"2024-03-03"} | ${"a Sunday ends a Monday-first week"}
  `(
    "returns $expected as the week end of $value with weekStartsOn $weekStartsOn ($description)",
    ({ value, weekStartsOn, expected }) => {
      expect(endOfDate(value, "week", { weekStartsOn })).toBe(expected);
    },
  );

  // -271821-04-19 is the first representable PlainDate (a Monday). The start of its month, year and
  // Sunday-first week lies before the range, but every end is representable and must be returned.
  it.each`
    value              | unit       | weekStartsOn | expected
    ${"-271821-04-19"} | ${"day"}   | ${undefined} | ${"-271821-04-19"}
    ${"-271821-04-19"} | ${"week"}  | ${"monday"}  | ${"-271821-04-25"}
    ${"-271821-04-19"} | ${"week"}  | ${"sunday"}  | ${"-271821-04-24"}
    ${"-271821-04-19"} | ${"month"} | ${undefined} | ${"-271821-04-30"}
    ${"-271821-04-19"} | ${"year"}  | ${undefined} | ${"-271821-12-31"}
  `(
    "returns $expected as the $unit end of the first PlainDate $value (weekStartsOn $weekStartsOn)",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(endOfDate(value, unit, { weekStartsOn })).toBe(expected);
    },
  );

  // Temporal §13.17 GetTemporalUnitValuedOption: a plural unit name is the same unit as its singular.
  it.each`
    unit        | expected
    ${"years"}  | ${"2024-12-31"}
    ${"months"} | ${"2024-02-29"}
    ${"weeks"}  | ${"2024-03-03"}
    ${"days"}   | ${"2024-02-29"}
  `(
    "returns $expected for plural unit $unit on 2024-02-29",
    ({ unit, expected }) => {
      expect(endOfDate("2024-02-29", unit)).toBe(expected);
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
      expect(endOfDate("2024-02-29", unit, { weekStartsOn })).toBe("");
    },
  );
});
