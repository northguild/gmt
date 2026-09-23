import { getWeekNumber } from "./getWeekNumber";

describe("getWeekNumber", () => {
  it.each`
    date            | weekStartsOn | expected
    ${"2024-01-01"} | ${"monday"}  | ${1}
    ${"2024-01-02"} | ${"monday"}  | ${1}
    ${"2024-01-03"} | ${"monday"}  | ${1}
    ${"2024-01-04"} | ${"monday"}  | ${1}
    ${"2024-01-07"} | ${"monday"}  | ${1}
    ${"2024-01-08"} | ${"monday"}  | ${2}
    ${"2024-06-15"} | ${"monday"}  | ${24}
    ${"2024-12-28"} | ${"monday"}  | ${52}
    ${"2024-12-31"} | ${"monday"}  | ${1}
    ${"2024-01-01"} | ${"sunday"}  | ${1}
    ${"2024-01-06"} | ${"sunday"}  | ${1}
    ${"2024-01-07"} | ${"sunday"}  | ${2}
    ${"2024-06-15"} | ${"sunday"}  | ${24}
    ${"2024-12-28"} | ${"sunday"}  | ${52}
    ${"2024-12-31"} | ${"sunday"}  | ${1}
  `(
    "returns $expected for $date with weekStartsOn $weekStartsOn",
    ({ date, weekStartsOn, expected }) => {
      expect(getWeekNumber(date, weekStartsOn)).toBe(expected);
    },
  );

  it.each`
    nonStringInput
    ${"invalid-date"}
    ${"2024-02-30"}
    ${null}
    ${undefined}
  `(
    "returns null for non-string input $nonStringInput",
    ({ nonStringInput }) => {
      expect(getWeekNumber(nonStringInput as never)).toBeNull();
    },
  );

  // Validate, then parse (isValidDate): each of these reads as week 11 or 24 if parsed loosely.
  // isValidDate reads annotations as Temporal.PlainDate.from does (RFC 9557 §3.3): `[u-ca=iso8601]`
  // names the ISO calendar and an elective annotation is ignored, so the week is the plain date's.
  it.each`
    value                         | weekStartsOn | expected
    ${"2024-06-15[u-ca=iso8601]"} | ${"monday"}  | ${24}
    ${"2024-06-15[u-ca=iso8601]"} | ${"sunday"}  | ${24}
    ${"2024-06-15[foo=bar]"}      | ${"monday"}  | ${24}
    ${"2024-06-15[!foo=bar]"}     | ${"monday"}  | ${null}
  `(
    "reads the annotations of $value ($weekStartsOn) → $expected",
    ({ value, weekStartsOn, expected }) => {
      expect(getWeekNumber(value, weekStartsOn)).toBe(expected);
    },
  );

  it.each`
    value                                        | shape
    ${"2024-03-15T10:00"}                        | ${"PlainDateTime"}
    ${"2024-03-15T10:00:00+05:30[Asia/Kolkata]"} | ${"zoned datetime"}
    ${"20240315"}                                | ${"basic format"}
    ${"2024-12-31T23:59:60"}                     | ${"leap second"}
    ${"2024-06-15[u-ca=hebrew]"}                 | ${"calendar annotation"}
  `(
    "returns null for $value ($shape) with either week start, which isValidDate rejects",
    ({ value }) => {
      expect(getWeekNumber(value, "monday")).toBeNull();
      expect(getWeekNumber(value, "sunday")).toBeNull();
    },
  );

  // UTS #35 Part 4 week-of-year with firstDay Sunday and minDays 1: week 1 is the Sunday-first
  // week holding 1 January, so the last days of December before a mid-week 1 January are week 1
  // of the next week-year. Week n's Saturday is day-of-year (week 1's Saturday) + 7(n - 1).
  // Weekdays and days of year checked with Temporal.PlainDate (dayOfWeek, dayOfYear).
  it.each`
    date            | expected | reason
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
    "returns $expected for $date with weekStartsOn sunday ($reason)",
    ({ date, expected }) => {
      expect(getWeekNumber(date, "sunday")).toBe(expected);
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
      expect(getWeekNumber("2024-03-15", weekStartsOn)).toBeNull();
    },
  );

  // An explicit undefined is the omitted argument (TC39 GetOption), so it is the ISO default.
  it("returns the ISO week for weekStartsOn undefined", () => {
    expect(getWeekNumber("2024-12-31", undefined)).toBe(1);
  });
});
