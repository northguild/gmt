import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { parseWeekFromDate } from "./parseWeekFromDate";

describe("parseWeekFromDate", () => {
  it.each`
    value           | expected
    ${"2024-01-01"} | ${1}
    ${"2024-01-07"} | ${1}
    ${"2024-01-08"} | ${2}
    ${"2024-02-29"} | ${9}
    ${"2024-12-31"} | ${1}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseWeekFromDate(value)).toBe(expected);
  });

  it.each`
    invalidDate
    ${"invalid-date"}
    ${"2024-02-30"}
    ${"2024-02-29T00:00:00"}
    ${null}
    ${undefined}
  `("returns null for invalid date $invalidDate", ({ invalidDate }) => {
    expect(parseWeekFromDate(invalidDate)).toBeNull();
  });

  it("returns null on failure", () => {
    mockTemporalPlainDateFromThrow();
    const result = parseWeekFromDate("2024-02-29");
    expect(result).toBeNull();
  });

  // UTS #35 Part 4 week-of-year with firstDay Sunday and minDays 1: week 1 is the Sunday-first
  // week holding 1 January, so the last days of December before a mid-week 1 January are week 1
  // of the next week-year. Week n's Saturday is day-of-year (week 1's Saturday) + 7(n - 1).
  // Weekdays and days of year checked with Temporal.PlainDate (dayOfWeek, dayOfYear).
  it.each`
    value           | expected | reason
    ${"2023-12-31"} | ${1}     | ${"Sunday of the week holding 1 January 2024 (a Monday)"}
    ${"2024-01-01"} | ${1}     | ${"Monday; week 1 of 2024 is Sun 2023-12-31 to Sat 2024-01-06"}
    ${"2024-03-17"} | ${12}    | ${"Sunday; its Saturday 2024-03-23 is day 83 = 6 + 7 x 11"}
    ${"2024-12-28"} | ${52}    | ${"Saturday, day 363 = 6 + 7 x 51"}
    ${"2024-12-29"} | ${1}     | ${"Sunday of the week holding 1 January 2025 (a Wednesday)"}
    ${"2024-12-31"} | ${1}     | ${"Tuesday in the week holding 1 January 2025"}
    ${"2000-01-01"} | ${1}     | ${"Saturday 1 January: a one-day-in-year week 1"}
    ${"2000-01-02"} | ${2}     | ${"Sunday after that one-day week 1"}
    ${"2000-12-30"} | ${53}    | ${"Saturday, day 365 = 1 + 7 x 52"}
    ${"2000-12-31"} | ${1}     | ${"Sunday of the week holding 1 January 2001 (a Monday)"}
    ${"2016-12-31"} | ${53}    | ${"Saturday, day 366 = 2 + 7 x 52 (1 January 2016 was a Friday)"}
    ${"2017-01-01"} | ${1}     | ${"Sunday 1 January starts week 1"}
  `(
    "returns $expected for $value with weekStartsOn sunday ($reason)",
    ({ value, expected }) => {
      expect(parseWeekFromDate(value, { weekStartsOn: "sunday" })).toBe(
        expected,
      );
    },
  );

  // weekStartsOn only names "monday" or "sunday"; any other value is invalid input, for every unit
  // (Temporal GetOption rejects a value outside its allowed list; undefined means the default).
  it.each`
    weekStartsOn
    ${"tuesday"}
    ${"Monday"}
    ${""}
    ${null}
    ${1}
    ${true}
  `(
    "returns null for 2024-03-15 with invalid weekStartsOn $weekStartsOn",
    ({ weekStartsOn }) => {
      expect(parseWeekFromDate("2024-03-15", { weekStartsOn })).toBeNull();
    },
  );
});
