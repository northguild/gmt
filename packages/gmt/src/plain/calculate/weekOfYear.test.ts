import { weekOfYear } from "./weekOfYear";

describe("weekOfYear", () => {
  // 2024-01-01 is a Monday, so it should be in week 1 regardless of weekStartsOn
  it.each`
    value           | weekStartsOn | expected
    ${"2024-01-01"} | ${undefined} | ${1}
    ${"2024-01-01"} | ${"monday"}  | ${1}
    ${"2024-01-01"} | ${"sunday"}  | ${1}
    ${"2024-02-29"} | ${undefined} | ${9}
    ${"2024-02-29"} | ${"monday"}  | ${9}
    ${"2024-02-29"} | ${"sunday"}  | ${10}
  `(
    "returns $expected for $value with weekStartsOn $weekStartsOn, defaulting to Monday",
    ({ value, weekStartsOn, expected }) => {
      expect(weekOfYear(value, { weekStartsOn })).toBe(expected);
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
  `("returns null for invalid date $invalidDate", ({ invalidDate }) => {
    expect(weekOfYear(invalidDate, { weekStartsOn: "monday" })).toBeNull();
  });

  // gracefully handle invalid weekStartsOn values by defaulting to Monday
  it.each`
    invalidWeekStartsOn
    ${"invalid-week-starts-on"}
    ${"mondayz"}
    ${"sundayz"}
    ${12}
    ${true}
    ${false}
    ${null}
    ${undefined}
  `(
    "defaults weekStartsOn to Monday for invalid value $invalidWeekStartsOn",
    ({ invalidWeekStartsOn }) => {
      expect(
        weekOfYear("2024-01-01", {
          weekStartsOn: invalidWeekStartsOn as never,
        }),
      ).toBe(1);
    },
  );
});
