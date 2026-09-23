import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { parseUnitFromDateTime } from "./parseUnitFromDateTime";

describe("parseUnitFromDateTime", () => {
  it.each`
    value                        | unit             | expected
    ${"2024-02-29T14:30:45.123"} | ${"year"}        | ${"2024"}
    ${"2024-02-29T14:30:45.123"} | ${"month"}       | ${"02"}
    ${"2024-02-29T14:30:45.123"} | ${"day"}         | ${"29"}
    ${"2024-02-29T14:30:45.123"} | ${"week"}        | ${"9"}
    ${"2024-02-29T14:30:45.123"} | ${"dayOfWeek"}   | ${"4"}
    ${"2024-02-29T14:30:45.123"} | ${"hour"}        | ${"14"}
    ${"2024-02-29T14:30:45.123"} | ${"minute"}      | ${"30"}
    ${"2024-02-29T14:30:45.123"} | ${"second"}      | ${"45"}
    ${"2024-02-29T14:30:45.123"} | ${"millisecond"} | ${"123"}
  `("returns $expected for valid unit $unit", ({ value, unit, expected }) => {
    expect(parseUnitFromDateTime(value, unit)).toBe(expected);
  });

  it.each`
    value                        | unit        | expected
    ${"0001-01-01T00:00:00.001"} | ${"year"}   | ${"1"}
    ${"2024-12-31T23:59:59"}     | ${"month"}  | ${"12"}
    ${"2024-03-01T08:05:09"}     | ${"minute"} | ${"05"}
  `(
    "returns $expected for edge case unit $unit",
    ({ value, unit, expected }) => {
      expect(parseUnitFromDateTime(value, unit)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"not-a-datetime"}
    ${"2024-02-29"}
    ${"2024-02-29T24:00:00"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid datetime $invalidValue",
    ({ invalidValue }) => {
      expect(parseUnitFromDateTime(invalidValue as never, "year")).toBe("");
    },
  );

  it.each`
    unit            | expected
    ${"picosecond"} | ${""}
    ${""}           | ${""}
    ${null}         | ${""}
    ${undefined}    | ${""}
  `("returns an empty string for invalid unit $unit", ({ unit, expected }) => {
    expect(
      parseUnitFromDateTime("2024-02-29T14:30:45.123", unit as never),
    ).toBe(expected);
  });

  it("returns an empty string on failure", () => {
    mockTemporalPlainDateTimeFromThrow();
    const result = parseUnitFromDateTime("2024-02-29T14:30:45.123", "year");
    expect(result).toBe("");
  });

  // UTS #35 Part 4, firstDay Sunday and minDays 1: 2024-12-31 (a Tuesday) shares its Sunday-first
  // week with 1 January 2025, so it is week 1; 2024-12-28 (Saturday, day 363 = 6 + 7 x 51) is 52.
  it("returns the UTS #35 Sunday-first week number at the year end", () => {
    expect(
      parseUnitFromDateTime("2024-12-31T12:00:00", "week", {
        weekStartsOn: "sunday",
      }),
    ).toBe("1");
    expect(
      parseUnitFromDateTime("2024-12-28T12:00:00", "week", {
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
        parseUnitFromDateTime("2024-03-15T12:00:00", unit, { weekStartsOn }),
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
    "returns $expected for plural unit $unit of 2024-03-17T13:45:30.123456789",
    ({ unit, expected }) => {
      expect(parseUnitFromDateTime("2024-03-17T13:45:30.123456789", unit)).toBe(
        expected,
      );
    },
  );
});

// Every family with a time reads the three sub-second Temporal fields (0-999 each), zero-padded to
// 3 digits like parseMillisecondFrom*/parseMicrosecondFrom*/parseNanosecondFrom*. Native Chromium
// 153 reads .000001002 as millisecond 0, microsecond 1, nanosecond 2.
describe("parseUnitFromDateTime sub-second units", () => {
  it.each`
    unit              | expected
    ${"millisecond"}  | ${"000"}
    ${"milliseconds"} | ${"000"}
    ${"microsecond"}  | ${"001"}
    ${"microseconds"} | ${"001"}
    ${"nanosecond"}   | ${"002"}
    ${"nanoseconds"}  | ${"002"}
  `(
    "returns $expected for unit $unit of 2024-03-15T14:30:45.000001002",
    ({ unit, expected }) => {
      expect(parseUnitFromDateTime("2024-03-15T14:30:45.000001002", unit)).toBe(
        expected,
      );
    },
  );
});
