import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { parseWeekFromZoned } from "./parseWeekFromZoned";

describe("parseWeekFromZoned", () => {
  it.each`
    value                               | expected
    ${"2024-03-15T14:30:45+00:00[UTC]"} | ${11}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${1}
    ${"2024-01-07T00:00:00+00:00[UTC]"} | ${1}
    ${"2024-01-08T00:00:00+00:00[UTC]"} | ${2}
    ${"2024-12-31T23:59:59+00:00[UTC]"} | ${1}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseWeekFromZoned(value)).toBe(expected);
  });

  it.each`
    value                               | weekStartsOn | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"monday"}  | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"sunday"}  | ${1}
    ${"2024-12-31T12:00:00+00:00[UTC]"} | ${"monday"}  | ${1}
    ${"2024-12-31T12:00:00+00:00[UTC]"} | ${"sunday"}  | ${1}
    ${"2000-12-31T12:00:00+00:00[UTC]"} | ${"sunday"}  | ${1}
  `(
    "returns $expected for $value with weekStartsOn $weekStartsOn",
    ({ value, weekStartsOn, expected }) => {
      expect(
        parseWeekFromZoned(value, { weekStartsOn: weekStartsOn as never }),
      ).toBe(expected);
    },
  );

  it.each`
    value
    ${"invalid"}
    ${""}
  `("returns null for invalid value $value", ({ value }) => {
    expect(parseWeekFromZoned(value)).toBeNull();
  });

  it("returns null on failure", () => {
    mockTemporalZonedDateTimeFromThrow();
    const result = parseWeekFromZoned("2024-03-15T14:30:45+00:00[UTC]");
    expect(result).toBeNull();
  });
});

// ISO 8601 week of an expanded or negative year. The Gregorian calendar repeats every 400 years:
// +010000-01-01 falls on the weekday of 2000-01-01 (Saturday), so it is in week 52 of 9999
// (like 1999-W52); -000001-01-01 falls on the weekday of 1999-01-01 (Friday), so it is in week 53
// of -2 (like 1998-W53).
describe("parseWeekFromZoned with a year outside 0000-9999", () => {
  it.each`
    value                                  | expected
    ${"+010000-01-01T00:00:00+00:00[UTC]"} | ${52}
    ${"-000001-01-01T00:00:00+00:00[UTC]"} | ${53}
  `("returns ISO week $expected for $value", ({ value, expected }) => {
    expect(parseWeekFromZoned(value)).toBe(expected);
  });

  // UTS #35 Part 4 week-of-year with firstDay Sunday and minDays 1: week 1 is the Sunday-first
  // week holding 1 January, so the last days of December before a mid-week 1 January are week 1
  // of the next week-year. Week n's Saturday is day-of-year (week 1's Saturday) + 7(n - 1).
  // Weekdays and days of year checked with Temporal.PlainDate (dayOfWeek, dayOfYear).
  it.each`
    value                               | expected | reason
    ${"2023-12-31T12:00:00+00:00[UTC]"} | ${1}     | ${"Sunday of the week holding 1 January 2024 (a Monday)"}
    ${"2024-01-01T12:00:00+00:00[UTC]"} | ${1}     | ${"Monday; week 1 of 2024 is Sun 2023-12-31 to Sat 2024-01-06"}
    ${"2024-03-17T12:00:00+00:00[UTC]"} | ${12}    | ${"Sunday; its Saturday 2024-03-23 is day 83 = 6 + 7 x 11"}
    ${"2024-12-28T12:00:00+00:00[UTC]"} | ${52}    | ${"Saturday, day 363 = 6 + 7 x 51"}
    ${"2024-12-29T12:00:00+00:00[UTC]"} | ${1}     | ${"Sunday of the week holding 1 January 2025 (a Wednesday)"}
    ${"2024-12-31T12:00:00+00:00[UTC]"} | ${1}     | ${"Tuesday in the week holding 1 January 2025"}
    ${"2000-01-01T12:00:00+00:00[UTC]"} | ${1}     | ${"Saturday 1 January: a one-day-in-year week 1"}
    ${"2000-01-02T12:00:00+00:00[UTC]"} | ${2}     | ${"Sunday after that one-day week 1"}
    ${"2000-12-30T12:00:00+00:00[UTC]"} | ${53}    | ${"Saturday, day 365 = 1 + 7 x 52"}
    ${"2000-12-31T12:00:00+00:00[UTC]"} | ${1}     | ${"Sunday of the week holding 1 January 2001 (a Monday)"}
    ${"2016-12-31T12:00:00+00:00[UTC]"} | ${53}    | ${"Saturday, day 366 = 2 + 7 x 52 (1 January 2016 was a Friday)"}
    ${"2017-01-01T12:00:00+00:00[UTC]"} | ${1}     | ${"Sunday 1 January starts week 1"}
  `(
    "returns $expected for $value with weekStartsOn sunday ($reason)",
    ({ value, expected }) => {
      expect(parseWeekFromZoned(value, { weekStartsOn: "sunday" })).toBe(
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
    "returns null for 2024-03-15T12:00:00+00:00[UTC] with invalid weekStartsOn $weekStartsOn",
    ({ weekStartsOn }) => {
      expect(
        parseWeekFromZoned("2024-03-15T12:00:00+00:00[UTC]", { weekStartsOn }),
      ).toBeNull();
    },
  );
});
