import { validOnlyBattleTestTimeZones } from "../../test";
import { isValidTimeZone } from ".";

describe("isValidTimeZone", () => {
  it.each(
    validOnlyBattleTestTimeZones.map((timeZone) => ({
      timeZone,
      expected: true,
    })),
  )("validates $timeZone as $expected", ({ timeZone, expected }) => {
    expect(isValidTimeZone(timeZone)).toBe(expected);
  });

  it.each`
    timeZone
    ${"Not/AZone"}
    ${""}
    ${null}
    ${undefined}
    ${123}
    ${true}
  `("returns false for invalid timeZone $timeZone", ({ timeZone }) => {
    expect(isValidTimeZone(timeZone as never)).toBe(false);
  });
});
