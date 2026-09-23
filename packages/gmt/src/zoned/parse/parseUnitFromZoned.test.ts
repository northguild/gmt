import { sameInstantBattleCases } from "../../test";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { parseUnitFromZoned } from "./parseUnitFromZoned";

describe("parseUnitFromZoned", () => {
  it.each`
    value                                               | unit             | expected
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"year"}        | ${"2024"}
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"month"}       | ${"02"}
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"day"}         | ${"29"}
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"hour"}        | ${"14"}
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"minute"}      | ${"30"}
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"second"}      | ${"45"}
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"millisecond"} | ${"123"}
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"timeZone"}    | ${"Europe/Helsinki"}
  `("returns $expected for valid unit $unit", ({ value, unit, expected }) => {
    expect(parseUnitFromZoned(value, unit)).toBe(expected);
  });

  it.each`
    value                          | unit          | expected
    ${"2024-02-29T14:30:45Z[UTC]"} | ${"timeZone"} | ${"UTC"}
  `(
    "returns $expected for edge case unit $unit",
    ({ value, unit, expected }) => {
      expect(parseUnitFromZoned(value, unit)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"2024-02-29T14:30:45.123-04:00"}
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid zoned datetime $invalidValue",
    ({ invalidValue }) => {
      expect(parseUnitFromZoned(invalidValue as never, "year")).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"picosecond"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid unit $invalidUnit",
    ({ invalidUnit }) => {
      expect(
        parseUnitFromZoned(
          "2024-02-29T14:30:45.123+02:00[Europe/Helsinki]",
          invalidUnit as never,
        ),
      ).toBe("");
    },
  );

  it.each`
    value                                               | unit      | weekStartsOn | expected
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"week"} | ${"monday"}  | ${"9"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}                 | ${"week"} | ${"sunday"}  | ${"1"}
  `(
    "returns $expected for unit $unit with weekStartsOn $weekStartsOn",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(parseUnitFromZoned(value, unit as never, { weekStartsOn })).toBe(
        expected,
      );
    },
  );

  it.each(sameInstantBattleCases)(
    "returns timeZone $timeZone for battle-test $value",
    ({ value, timeZone }) => {
      expect(parseUnitFromZoned(value, "timeZone")).toBe(timeZone);
    },
  );

  it("returns empty string on failure", () => {
    mockTemporalZonedDateTimeFromThrow();
    const result = parseUnitFromZoned(
      "2024-02-29T14:30:45.123+02:00[Europe/Helsinki]",
      "year",
    );
    expect(result).toBe("");
  });
});

// ISO 8601 week of an expanded or negative year. The Gregorian calendar repeats every 400 years:
// +010000-01-01 falls on the weekday of 2000-01-01 (Saturday), so it is in week 52 of 9999
// (like 1999-W52); -000001-01-01 falls on the weekday of 1999-01-01 (Friday), so it is in week 53
// of -2 (like 1998-W53).
describe("parseUnitFromZoned week with a year outside 0000-9999", () => {
  it.each`
    value                                  | expected
    ${"+010000-01-01T00:00:00+00:00[UTC]"} | ${"52"}
    ${"-000001-01-01T00:00:00+00:00[UTC]"} | ${"53"}
  `("returns ISO week $expected for $value", ({ value, expected }) => {
    expect(parseUnitFromZoned(value, "week")).toBe(expected);
  });

  // UTS #35 Part 4, firstDay Sunday and minDays 1: 2024-12-31 (a Tuesday) shares its Sunday-first
  // week with 1 January 2025, so it is week 1; 2024-12-28 (Saturday, day 363 = 6 + 7 x 51) is 52.
  it("returns the UTS #35 Sunday-first week number at the year end", () => {
    expect(
      parseUnitFromZoned("2024-12-31T12:00:00+00:00[UTC]", "week", {
        weekStartsOn: "sunday",
      }),
    ).toBe("1");
    expect(
      parseUnitFromZoned("2024-12-28T12:00:00+00:00[UTC]", "week", {
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
        parseUnitFromZoned("2024-03-15T12:00:00+00:00[UTC]", unit, {
          weekStartsOn,
        }),
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
    ${"nanoseconds"}  | ${"789"}
  `(
    "returns $expected for plural unit $unit of 2024-03-17T13:45:30.123456789+01:00[Europe/Berlin]",
    ({ unit, expected }) => {
      expect(
        parseUnitFromZoned(
          "2024-03-17T13:45:30.123456789+01:00[Europe/Berlin]",
          unit,
        ),
      ).toBe(expected);
    },
  );
});

// Every family with a time reads the three sub-second Temporal fields (0-999 each), zero-padded to
// 3 digits like parseMillisecondFrom*/parseMicrosecondFrom*/parseNanosecondFrom*. Native Chromium
// 153 reads .000001002 as millisecond 0, microsecond 1, nanosecond 2.
describe("parseUnitFromZoned sub-second units", () => {
  it.each`
    unit              | expected
    ${"millisecond"}  | ${"000"}
    ${"milliseconds"} | ${"000"}
    ${"microsecond"}  | ${"001"}
    ${"microseconds"} | ${"001"}
    ${"nanosecond"}   | ${"002"}
    ${"nanoseconds"}  | ${"002"}
  `(
    "returns $expected for unit $unit of 2024-03-15T14:30:45.000001002+00:00[UTC]",
    ({ unit, expected }) => {
      expect(
        parseUnitFromZoned("2024-03-15T14:30:45.000001002+00:00[UTC]", unit),
      ).toBe(expected);
    },
  );
});
