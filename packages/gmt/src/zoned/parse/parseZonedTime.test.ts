import { localNoonBattleCases } from "../test/timezoneFixtures";
import { parseZonedTime } from "./parseZonedTime";

describe("parseZonedTime", () => {
  it.each`
    value                                                | expected
    ${"2024-02-29T14:30-05:00[America/New_York]"}        | ${"14:30:00"}
    ${"2024-02-29T14:30:45.123-05:00[America/New_York]"} | ${"14:30:45.123"}
  `("returns the plain time portion for $value", ({ value, expected }) => {
    expect(parseZonedTime(value)).toBe(expected);
  });

  it.each`
    value                                            | expected
    ${"2024-03-10T01:30:00-05:00[America/New_York]"} | ${"01:30:00"}
  `("returns edge case time portion for $value", ({ value, expected }) => {
    expect(parseZonedTime(value)).toBe(expected);
  });

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
      expect(parseZonedTime(invalidValue as never)).toBe("");
    },
  );

  for (const { timeZone, value } of localNoonBattleCases) {
    it(`returns the local time for battle-test timezone ${timeZone}`, () => {
      expect(parseZonedTime(value)).toBe("12:00:00");
    });
  }
});
