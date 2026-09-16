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
    ${"microsecond"}
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
});
