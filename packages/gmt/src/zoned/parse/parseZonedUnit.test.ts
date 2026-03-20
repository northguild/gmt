import { sameInstantBattleCases } from "../test/timezoneFixtures";
import { parseZonedUnit } from "./parseZonedUnit";

// TODO need tew parseZonedTimezone
describe("parseZonedUnit", () => {
  it.each`
    value                                               | unit             | expected
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"year"}        | ${"2024"}
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"month"}       | ${"02"}
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"day"}         | ${"29"}
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"hour"}        | ${"14"}
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"minute"}      | ${"30"}
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"second"}      | ${"45"}
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"millisecond"} | ${"123"}
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"timezone"}    | ${"Europe/Helsinki"}
  `("returns $expected for valid unit $unit", ({ value, unit, expected }) => {
    expect(parseZonedUnit(value, unit)).toBe(expected);
  });

  it.each`
    value                          | unit          | expected
    ${"2024-02-29T14:30:45Z[UTC]"} | ${"timezone"} | ${"UTC"}
  `(
    "returns $expected for edge case unit $unit",
    ({ value, unit, expected }) => {
      expect(parseZonedUnit(value, unit)).toBe(expected);
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
      expect(parseZonedUnit(invalidValue as never, "year")).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"week"}
    ${"microsecond"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid unit $invalidUnit",
    ({ invalidUnit }) => {
      expect(
        parseZonedUnit(
          "2024-02-29T14:30:45.123+02:00[Europe/Helsinki]",
          invalidUnit as never,
        ),
      ).toBe("");
    },
  );

  for (const { timeZone, value } of sameInstantBattleCases) {
    it(`returns timezone unit for battle-test timezone ${timeZone}`, () => {
      expect(parseZonedUnit(value, "timezone")).toBe(timeZone);
    });
  }
});
