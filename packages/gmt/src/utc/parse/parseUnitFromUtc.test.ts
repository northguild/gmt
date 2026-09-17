import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { parseUnitFromUtc } from "./parseUnitFromUtc";

describe("parseUnitFromUtc", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it.each`
    value                         | unit             | expected
    ${"2024-03-17T14:30:45Z"}     | ${"year"}        | ${"2024"}
    ${"2024-03-17T14:30:45Z"}     | ${"month"}       | ${"03"}
    ${"2024-03-17T14:30:45Z"}     | ${"day"}         | ${"17"}
    ${"2024-03-17T14:30:45Z"}     | ${"hour"}        | ${"14"}
    ${"2024-03-17T14:30:45Z"}     | ${"minute"}      | ${"30"}
    ${"2024-03-17T14:30:45Z"}     | ${"second"}      | ${"45"}
    ${"2024-03-17T14:30:45.123Z"} | ${"millisecond"} | ${"123"}
  `(
    "returns $expected for $value and unit $unit",
    ({ value, unit, expected }) => {
      expect(parseUnitFromUtc(value, unit)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"invalid-date"}
    ${"2024-03-17T14:30:45"}
    ${"2024-03-17T14:30:45+00:00"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `(
    "returns empty string for invalid value $invalidValue",
    ({ invalidValue }) => {
      expect(parseUnitFromUtc(invalidValue, "year")).toBe("");
    },
  );

  it("returns empty string on failure", () => {
    mockTemporalInstantFromThrow();
    const result = parseUnitFromUtc("2024-03-17T14:30:45Z", "year");
    expect(result).toBe("");
  });
});

// ISO 8601 week of an expanded or negative year. The Gregorian calendar repeats every 400 years:
// +010000-01-01 falls on the weekday of 2000-01-01 (Saturday), so it is in week 52 of 9999
// (like 1999-W52); -000001-01-01 falls on the weekday of 1999-01-01 (Friday), so it is in week 53
// of -2 (like 1998-W53).
describe("parseUnitFromUtc week with a year outside 0000-9999", () => {
  it.each`
    value                        | expected
    ${"+010000-01-01T00:00:00Z"} | ${"52"}
    ${"-000001-01-01T00:00:00Z"} | ${"53"}
  `("returns ISO week $expected for $value", ({ value, expected }) => {
    expect(parseUnitFromUtc(value, "week")).toBe(expected);
  });

  // UTS #35 Part 4, firstDay Sunday and minDays 1: 2024-12-31 (a Tuesday) shares its Sunday-first
  // week with 1 January 2025, so it is week 1; 2024-12-28 (Saturday, day 363 = 6 + 7 x 51) is 52.
  it("returns the UTS #35 Sunday-first week number at the year end", () => {
    expect(
      parseUnitFromUtc("2024-12-31T12:00:00Z", "week", {
        weekStartsOn: "sunday",
      }),
    ).toBe("1");
    expect(
      parseUnitFromUtc("2024-12-28T12:00:00Z", "week", {
        weekStartsOn: "sunday",
      }),
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
    ${"hour"} | ${"tuesday"}
    ${"hour"} | ${"Monday"}
    ${"hour"} | ${""}
    ${"hour"} | ${null}
    ${"hour"} | ${1}
    ${"hour"} | ${true}
  `(
    "returns an empty string for unit $unit with invalid weekStartsOn $weekStartsOn",
    ({ unit, weekStartsOn }) => {
      expect(
        parseUnitFromUtc("2024-03-15T12:00:00Z", unit, { weekStartsOn }),
      ).toBe("");
    },
  );

  // The value is read on the wall clock of `timeZone` (default UTC), as `parseTimeFromUtc` does.
  // Expected fields from Temporal.Instant#toZonedDateTimeISO and native Intl.DateTimeFormat:
  // 2024-03-17T02:30:45.123456789Z is Saturday 2024-03-16T22:30:45.123456789-04:00 in New York and
  // Sunday 08:00:45.123456789+05:30 in Kolkata; 2025-01-01T02:00:00Z is 2024-12-31T21:00-05:00 in New York.
  it.each`
    unit        | timeZone              | expected
    ${"day"}    | ${"America/New_York"} | ${"16"}
    ${"hour"}   | ${"America/New_York"} | ${"22"}
    ${"minute"} | ${"Asia/Kolkata"}     | ${"00"}
    ${"year"}   | ${"UTC"}              | ${"2024"}
    ${"day"}    | ${undefined}          | ${"17"}
  `(
    "returns $expected for unit $unit of 2024-03-17T02:30:45Z with timeZone $timeZone",
    ({ unit, timeZone, expected }) => {
      expect(
        parseUnitFromUtc("2024-03-17T02:30:45.123456789Z", unit, { timeZone }),
      ).toBe(expected);
    },
  );

  // Sunday-first (UTS #35): Sunday 2024-03-17 opens week 12; New York's Saturday 2024-03-16 is week 11.
  it.each`
    timeZone              | expected
    ${"UTC"}              | ${"12"}
    ${"America/New_York"} | ${"11"}
  `(
    "returns week $expected with weekStartsOn sunday and timeZone $timeZone",
    ({ timeZone, expected }) => {
      expect(
        parseUnitFromUtc("2024-03-17T02:30:45.123456789Z", "week", {
          weekStartsOn: "sunday",
          timeZone,
        }),
      ).toBe(expected);
    },
  );

  // An unknown IANA zone is invalid input; an explicit undefined is the omitted option (UTC).
  it.each`
    timeZone
    ${"Mars/Olympus"}
    ${""}
    ${null}
  `(
    "returns an empty string for invalid timeZone $timeZone",
    ({ timeZone }) => {
      expect(
        parseUnitFromUtc("2024-03-17T02:30:45.123456789Z", "day", { timeZone }),
      ).toBe("");
    },
  );

  // Temporal §13.17 GetTemporalUnitValuedOption: a plural unit name is the same unit as its singular.
  it.each`
    unit              | expected
    ${"years"}        | ${"2024"}
    ${"months"}       | ${"03"}
    ${"weeks"}        | ${"11"}
    ${"days"}         | ${"17"}
    ${"hours"}        | ${"13"}
    ${"minutes"}      | ${"45"}
    ${"seconds"}      | ${"30"}
    ${"milliseconds"} | ${"123"}
  `(
    "returns $expected for plural unit $unit of 2024-03-17T13:45:30.123456789Z",
    ({ unit, expected }) => {
      expect(parseUnitFromUtc("2024-03-17T13:45:30.123456789Z", unit)).toBe(
        expected,
      );
    },
  );
});

// Every family with a time reads the three sub-second Temporal fields (0-999 each), zero-padded to
// 3 digits like parseMillisecondFrom*/parseMicrosecondFrom*/parseNanosecondFrom*. Native Chromium
// 153 reads .000001002 as millisecond 0, microsecond 1, nanosecond 2.
describe("parseUnitFromUtc sub-second units", () => {
  it.each`
    unit              | expected
    ${"millisecond"}  | ${"000"}
    ${"milliseconds"} | ${"000"}
    ${"microsecond"}  | ${"001"}
    ${"microseconds"} | ${"001"}
    ${"nanosecond"}   | ${"002"}
    ${"nanoseconds"}  | ${"002"}
  `(
    "returns $expected for unit $unit of 2024-03-17T14:30:45.000001002Z",
    ({ unit, expected }) => {
      expect(parseUnitFromUtc("2024-03-17T14:30:45.000001002Z", unit)).toBe(
        expected,
      );
    },
  );
});
