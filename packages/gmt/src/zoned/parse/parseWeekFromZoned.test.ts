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
    ${"2024-12-31T12:00:00+00:00[UTC]"} | ${"sunday"}  | ${53}
    ${"2000-12-31T12:00:00+00:00[UTC]"} | ${"sunday"}  | ${54}
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
});
