import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { isBusinessDay } from "./isBusinessDay";

describe("isBusinessDay", () => {
  // Full week boundary coverage — fixed ISO Monday–Friday business days.
  it.each`
    value           | expected
    ${"2024-02-02"} | ${true}
    ${"2024-02-03"} | ${false}
    ${"2024-02-04"} | ${false}
    ${"2024-02-05"} | ${true}
    ${"2024-02-06"} | ${true}
    ${"2024-02-07"} | ${true}
    ${"2024-02-08"} | ${true}
  `(
    "returns $expected for $value (Mon–Fri business day)",
    ({ value, expected }) => {
      expect(isBusinessDay(value)).toBe(expected);
    },
  );

  // Leap year edge cases — Feb 29 falls on different weekdays across years.
  it.each`
    value           | expected | description
    ${"2024-02-29"} | ${true}  | ${"Thursday"}
    ${"2025-02-29"} | ${false} | ${"Saturday"}
  `(
    "returns $expected for $value (on a $description)",
    ({ value, expected }) => {
      expect(isBusinessDay(value)).toBe(expected);
    },
  );

  // Year-boundary dates — extreme years that happen to fall on Mon/Fri.
  it.each`
    value           | expected | description
    ${"0001-01-01"} | ${true}  | ${"Monday"}
    ${"9999-12-31"} | ${true}  | ${"Friday"}
  `(
    "returns $expected for $value (on a $description)",
    ({ value, expected }) => {
      expect(isBusinessDay(value)).toBe(expected);
    },
  );

  // Cross-year weekend consistency — Saturdays and Sundays in different years.
  it.each`
    value           | expected | description
    ${"2025-01-04"} | ${false} | ${"Saturday"}
    ${"2026-01-03"} | ${false} | ${"Sunday"}
    ${"2025-01-05"} | ${false} | ${"Monday"}
  `("returns $expected for $value $description", ({ value, expected }) => {
    expect(isBusinessDay(value)).toBe(expected);
  });

  it.each`
    value
    ${"invalid-date"}
    ${"2024-02-30"}
    ${"2024-02-29T00:00:00"}
    ${""}
    ${"   "}
    ${" 2024-02-05 "}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns false for invalid value $value", ({ value }) => {
    expect(isBusinessDay(value)).toBe(false);
  });

  it("returns false when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(isBusinessDay("2024-02-05")).toBe(false);
  });
});
