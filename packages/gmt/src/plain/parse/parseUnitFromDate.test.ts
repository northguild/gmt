import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { parseUnitFromDate } from "./parseUnitFromDate";

describe("parseUnitFromDate", () => {
  it.each`
    value           | unit           | expected
    ${"2024-02-29"} | ${"year"}      | ${"2024"}
    ${"2024-02-29"} | ${"month"}     | ${"02"}
    ${"2024-02-29"} | ${"day"}       | ${"29"}
    ${"2024-02-29"} | ${"week"}      | ${"9"}
    ${"2024-02-29"} | ${"dayOfWeek"} | ${"4"}
  `("returns $expected for valid unit $unit", ({ value, unit, expected }) => {
    expect(parseUnitFromDate(value, unit)).toBe(expected);
  });

  it.each`
    value           | unit       | expected
    ${"0001-01-01"} | ${"year"}  | ${"1"}
    ${"2024-12-31"} | ${"month"} | ${"12"}
    ${"2024-03-01"} | ${"day"}   | ${"01"}
  `(
    "returns $expected for edge case unit $unit",
    ({ value, unit, expected }) => {
      expect(parseUnitFromDate(value, unit)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"not-a-date"}
    ${"2024-02-30"}
    ${"2024-02-29T12:00:00"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid date $invalidValue",
    ({ invalidValue }) => {
      expect(parseUnitFromDate(invalidValue as never, "year")).toBe("");
    },
  );

  it.each`
    unit         | expected
    ${"hour"}    | ${""}
    ${""}        | ${""}
    ${null}      | ${""}
    ${undefined} | ${""}
  `("returns an empty string for invalid unit $unit", ({ unit, expected }) => {
    expect(parseUnitFromDate("2024-02-29", unit as never)).toBe(expected);
  });

  it("returns an empty string on failure", () => {
    mockTemporalPlainDateFromThrow();
    const result = parseUnitFromDate("2024-02-29", "year");
    expect(result).toBe("");
  });

  // UTS #35 Part 4, firstDay Sunday and minDays 1: 2024-12-31 (a Tuesday) shares its Sunday-first
  // week with 1 January 2025, so it is week 1; 2024-12-28 (Saturday, day 363 = 6 + 7 x 51) is 52.
  it("returns the UTS #35 Sunday-first week number at the year end", () => {
    expect(
      parseUnitFromDate("2024-12-31", "week", { weekStartsOn: "sunday" }),
    ).toBe("1");
    expect(
      parseUnitFromDate("2024-12-28", "week", { weekStartsOn: "sunday" }),
    ).toBe("52");
  });

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
      expect(parseUnitFromDate("2024-03-15", unit, { weekStartsOn })).toBe("");
    },
  );

  // Temporal §13.17 GetTemporalUnitValuedOption: a plural unit name is the same unit as its singular.
  it.each`
    unit        | expected
    ${"years"}  | ${"2024"}
    ${"months"} | ${"03"}
    ${"weeks"}  | ${"11"}
    ${"days"}   | ${"17"}
  `(
    "returns $expected for plural unit $unit of 2024-03-17",
    ({ unit, expected }) => {
      expect(parseUnitFromDate("2024-03-17", unit)).toBe(expected);
    },
  );
});
