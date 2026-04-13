import { validOnlyBattleTestTimeZones } from "../../test";
import { isValidTimeZone } from ".";

describe("isValidTimeZone", () => {
  it.each`
    timeZone                 | expected
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
  `("validates $timeZone as $expected", ({ timeZone, expected }) => {
    expect(isValidTimeZone(timeZone)).toBe(expected);
  });

  it.each`
    timeZone
    ${"Not/AZone"}
    ${"UTC+1"}
    ${""}
    ${null}
    ${undefined}
  `("returns false for invalid timeZone $timeZone", ({ timeZone }) => {
    expect(isValidTimeZone(timeZone as never)).toBe(false);
  });

  for (const timeZone of validOnlyBattleTestTimeZones) {
    it(`accepts battle-test timeZone ${timeZone}`, () => {
      expect(isValidTimeZone(timeZone)).toBe(true);
    });
  }
});
