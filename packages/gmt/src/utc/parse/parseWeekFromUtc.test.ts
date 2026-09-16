import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { parseWeekFromUtc } from "./parseWeekFromUtc";

describe("parseWeekFromUtc", () => {
  it.each`
    value                     | expected
    ${"2024-03-17T14:30:45Z"} | ${11}
    ${"2024-01-01T00:00:00Z"} | ${1}
    ${"2024-01-07T00:00:00Z"} | ${1}
    ${"2024-01-08T00:00:00Z"} | ${2}
    ${"2024-12-31T23:59:59Z"} | ${1}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseWeekFromUtc(value)).toBe(expected);
  });

  it.each`
    value                     | weekStartsOn | expected
    ${"2024-01-01T00:00:00Z"} | ${"monday"}  | ${1}
    ${"2024-01-01T00:00:00Z"} | ${"sunday"}  | ${1}
  `(
    "returns $expected for $value with weekStartsOn $weekStartsOn",
    ({ value, weekStartsOn, expected }) => {
      expect(
        parseWeekFromUtc(value, { weekStartsOn: weekStartsOn as never }),
      ).toBe(expected);
    },
  );

  it.each`
    value
    ${"invalid"}
    ${""}
  `("returns null for invalid value $value", ({ value }) => {
    expect(parseWeekFromUtc(value)).toBeNull();
  });

  it("returns null when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    const result = parseWeekFromUtc("2024-03-17T14:30:45Z");
    expect(result).toBeNull();
  });
});

// ISO 8601 week of an expanded or negative year. The Gregorian calendar repeats every 400 years:
// +010000-01-01 falls on the weekday of 2000-01-01 (Saturday), so it is in week 52 of 9999
// (like 1999-W52); -000001-01-01 falls on the weekday of 1999-01-01 (Friday), so it is in week 53
// of -2 (like 1998-W53).
describe("parseWeekFromUtc with a year outside 0000-9999", () => {
  it.each`
    value                        | expected
    ${"+010000-01-01T00:00:00Z"} | ${52}
    ${"-000001-01-01T00:00:00Z"} | ${53}
  `("returns ISO week $expected for $value", ({ value, expected }) => {
    expect(parseWeekFromUtc(value)).toBe(expected);
  });
});
