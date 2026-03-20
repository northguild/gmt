import { sameInstantBattleCases } from "../test/timezoneFixtures";
import { parseZonedTimezone } from "./parseZonedTimezone";

describe("parseZonedTimezone", () => {
  it.each`
    value                                                | expected
    ${"2024-02-29T14:30:45.123-05:00[America/New_York]"} | ${"America/New_York"}
    ${"2024-02-29T14:30:45Z[UTC]"}                       | ${"UTC"}
  `("returns timezone $expected for $value", ({ value, expected }) => {
    expect(parseZonedTimezone(value)).toBe(expected);
  });

  it.each`
    value                                        | expected
    ${"2024-02-29T14:30:45+01:00[Europe/Paris]"} | ${"Europe/Paris"}
  `(
    "returns edge case timezone $expected for $value",
    ({ value, expected }) => {
      expect(parseZonedTimezone(value)).toBe(expected);
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
      expect(parseZonedTimezone(invalidValue as never)).toBe("");
    },
  );

  for (const { timeZone, value } of sameInstantBattleCases) {
    it(`returns the battle-test timezone ${timeZone}`, () => {
      expect(parseZonedTimezone(value)).toBe(timeZone);
    });
  }
});
