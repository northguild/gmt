import { sameInstantBattleCases } from "../test/timezoneFixtures";
import { convertTimezoneToUtc } from "./convertTimezoneToUtc";

describe("convertTimezoneToUtc", () => {
  it.each`
    value                                            | expected
    ${"2024-02-29T09:30:45-05:00[America/New_York]"} | ${"2024-02-29T14:30:45Z"}
    ${"2024-02-29T14:30:45+00:00[UTC]"}              | ${"2024-02-29T14:30:45Z"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(convertTimezoneToUtc(value)).toBe(expected);
  });

  it.each`
    invalidValue
    ${"invalid"}
    ${"2024-02-29T14:30:45"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid zoned datetime $invalidValue",
    ({ invalidValue }) => {
      expect(convertTimezoneToUtc(invalidValue as never)).toBe("");
    },
  );

  for (const { timeZone, value, utc } of sameInstantBattleCases) {
    it(`converts battle-test timezone ${timeZone} to shared UTC instant`, () => {
      expect(convertTimezoneToUtc(value)).toBe(utc);
    });
  }
});
