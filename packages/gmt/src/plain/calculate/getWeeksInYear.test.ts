import { getWeeksInYear } from "./getWeeksInYear";

describe("getWeeksInYear", () => {
  // Range edges. ISO 8601 week-year Y has 53 weeks exactly when January 1 is a Thursday, or a
  // Wednesday in a leap year (p(Y) = 4 or p(Y - 1) = 3, p(y) = (y + ⌊y/4⌋ - ⌊y/100⌋ + ⌊y/400⌋) mod 7).
  // +275760-01-01 is a Tuesday and -271821-01-01 a Friday, so both years have 52; every edge date
  // below lies in its own calendar year's week-year.
  it.each`
    value              | expected
    ${"-271821-04-19"} | ${52}
    ${"+275760-01-01"} | ${52}
    ${"+275760-09-13"} | ${52}
  `(
    "returns $expected ISO weeks for the range-edge date $value",
    ({ value, expected }) => {
      expect(getWeeksInYear(value)).toBe(expected);
    },
  );

  it.each`
    value           | expected
    ${"2024-06-15"} | ${52}
    ${"2020-06-15"} | ${53}
    ${"2015-06-15"} | ${53}
    ${"2026-06-15"} | ${53}
    ${"2021-01-01"} | ${53}
    ${"2020-12-31"} | ${53}
    ${"2024-12-31"} | ${52}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(getWeeksInYear(value)).toBe(expected);
  });

  it("returns 53 for a date belonging to a different ISO week-year than its calendar year", () => {
    // 2021-01-01 falls in ISO week-year 2020's week 53, not week 1 of 2021.
    expect(getWeeksInYear("2021-01-01")).toBe(53);
  });

  it.each`
    nonStringInput
    ${"invalid-date"}
    ${"2024-02-30"}
    ${"2024-02-29T00:00:00"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
    ${[]}
  `(
    "returns null for non-string input $nonStringInput",
    ({ nonStringInput }) => {
      expect(getWeeksInYear(nonStringInput)).toBeNull();
    },
  );
});
