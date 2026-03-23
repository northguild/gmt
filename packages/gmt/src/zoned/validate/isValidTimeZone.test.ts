import { validOnlyBattleTestTimeZones } from "../test/timezoneFixtures";
import { isValidTimezone } from ".";

describe("isValidTimezone", () => {
  it.each`
    timezone                 | expected
    ${"UTC"}                 | ${true}
    ${"Etc/GMT"}             | ${true}
    ${"GMT"}                 | ${true}
    ${"Europe/Lisbon"}       | ${true}
    ${"Europe/Dublin"}       | ${true}
    ${"Europe/Berlin"}       | ${true}
    ${"Europe/Helsinki"}     | ${true}
    ${"Europe/Istanbul"}     | ${true}
    ${"Asia/Kolkata"}        | ${true}
    ${"Asia/Kathmandu"}      | ${true}
    ${"Asia/Shanghai"}       | ${true}
    ${"Australia/Lord_Howe"} | ${true}
    ${"Pacific/Chatham"}     | ${true}
    ${"Pacific/Apia"}        | ${true}
    ${"Pacific/Niue"}        | ${true}
    ${"America/New_York"}    | ${true}
    ${"America/Chicago"}     | ${true}
    ${"America/Phoenix"}     | ${true}
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
