import { areDatesEqualBy } from "./areDatesEqualBy";

describe("areDatesEqualBy", () => {
  it.each`
    value1          | value2          | unit
    ${"2024-03-15"} | ${"2024-03-15"} | ${"day"}
    ${"2024-03-01"} | ${"2024-03-31"} | ${"month"}
    ${"2024-01-01"} | ${"2024-12-31"} | ${"year"}
    ${"2024-03-11"} | ${"2024-03-17"} | ${"week"}
  `(
    "returns true for $value1 and $value2 equal by $unit",
    ({ value1, value2, unit }) => {
      expect(areDatesEqualBy(value1, value2, unit)).toBe(true);
    },
  );

  it.each`
    value1          | value2          | unit
    ${"2024-03-15"} | ${"2024-03-16"} | ${"day"}
    ${"2024-03-31"} | ${"2024-04-01"} | ${"month"}
    ${"2024-01-01"} | ${"2025-01-01"} | ${"year"}
    ${"2024-03-17"} | ${"2024-03-18"} | ${"week"}
  `(
    "returns false for $value1 and $value2 unequal by $unit",
    ({ value1, value2, unit }) => {
      expect(areDatesEqualBy(value1, value2, unit)).toBe(false);
    },
  );

  it("returns false when the same month falls in different years", () => {
    expect(areDatesEqualBy("2023-03-15", "2024-03-15", "month")).toBe(false);
  });

  it.each`
    weekStartsOn | expected
    ${"monday"}  | ${true}
    ${"sunday"}  | ${false}
  `(
    "returns $expected for 2024-03-11 vs 2024-03-17 by week when weekStartsOn is $weekStartsOn",
    ({ weekStartsOn, expected }) => {
      expect(
        areDatesEqualBy("2024-03-11", "2024-03-17", "week", { weekStartsOn }),
      ).toBe(expected);
    },
  );

  it.each`
    unit
    ${"hour"}
    ${"minute"}
  `("returns false for unsupported unit $unit", ({ unit }) => {
    expect(areDatesEqualBy("2024-03-15", "2024-03-15", unit)).toBe(false);
  });

  it.each`
    value1          | value2
    ${""}           | ${""}
    ${null}         | ${"2024-03-15"}
    ${undefined}    | ${"2024-03-15"}
    ${"not-a-date"} | ${"2024-03-15"}
    ${"2024-03-15"} | ${null}
    ${"2024-03-15"} | ${undefined}
    ${"2024-03-15"} | ${"not-a-date"}
  `(
    "returns false for invalid input $value1 and $value2",
    ({ value1, value2 }) => {
      expect(areDatesEqualBy(value1 as never, value2 as never, "month")).toBe(
        false,
      );
    },
  );

  // Temporal §13.17 GetTemporalUnitValuedOption: a plural unit name is the same unit as its singular.
  it.each`
    unit        | value1          | value2          | expected
    ${"years"}  | ${"2024-01-01"} | ${"2024-12-31"} | ${true}
    ${"years"}  | ${"2024-12-31"} | ${"2025-01-01"} | ${false}
    ${"months"} | ${"2024-02-01"} | ${"2024-02-29"} | ${true}
    ${"months"} | ${"2024-02-29"} | ${"2024-03-01"} | ${false}
    ${"weeks"}  | ${"2024-02-26"} | ${"2024-03-03"} | ${true}
    ${"weeks"}  | ${"2024-03-03"} | ${"2024-03-04"} | ${false}
    ${"days"}   | ${"2024-02-29"} | ${"2024-02-29"} | ${true}
    ${"days"}   | ${"2024-02-29"} | ${"2024-03-01"} | ${false}
  `(
    "returns $expected for $value1 and $value2 by plural unit $unit",
    ({ unit, value1, value2, expected }) => {
      expect(areDatesEqualBy(value1, value2, unit)).toBe(expected);
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
    "returns false by unit $unit with invalid weekStartsOn $weekStartsOn",
    ({ unit, weekStartsOn }) => {
      expect(
        areDatesEqualBy("2024-02-29", "2024-02-29", unit, { weekStartsOn }),
      ).toBe(false);
    },
  );
});
