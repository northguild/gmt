import { validOnlyBattleTestTimeZones } from "../test/timezoneFixtures";
import { isValidTimezone } from ".";

describe("isValidTimezone", () => {
  it.each`
    timezone              | expected
    ${"Pacific/Apia"}     | ${true}
    ${"America/New_York"} | ${true}
    ${"Europe/London"}    | ${true}
    ${"Pacific/Niue"}     | ${true}
  `("validates $timezone as $expected", ({ timezone, expected }) => {
    expect(isValidTimezone(timezone)).toBe(expected);
  });

  it.each`
    timezone
    ${"Not/AZone"}
    ${"UTC+1"}
    ${""}
    ${null}
    ${undefined}
  `("returns false for invalid timezone $timezone", ({ timezone }) => {
    expect(isValidTimezone(timezone as never)).toBe(false);
  });

  for (const timezone of validOnlyBattleTestTimeZones) {
    it(`accepts battle-test timezone ${timezone}`, () => {
      expect(isValidTimezone(timezone)).toBe(true);
    });
  }
});
