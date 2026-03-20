import { parseZonedTimezone } from "../parse";
import { sameInstantBattleCases } from "../test/timezoneFixtures";
import { convertZonedToZoned } from "./convertZonedToZoned";

describe("convertZonedToZoned", () => {
  it.each`
    value                                            | timeZone              | expected
    ${"2024-02-29T09:30:45-05:00[America/New_York]"} | ${"UTC"}              | ${"2024-02-29T14:30:45+00:00[UTC]"}
    ${"2024-02-29T14:30:45+00:00[UTC]"}              | ${"America/New_York"} | ${"2024-02-29T09:30:45-05:00[America/New_York]"}
  `(
    "converts $value to $expected in $timeZone",
    ({ value, timeZone, expected }) => {
      expect(convertZonedToZoned(value, timeZone)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid zoned datetime $invalidValue",
    ({ invalidValue }) => {
      expect(convertZonedToZoned(invalidValue as never, "UTC")).toBe("");
    },
  );

  it.each`
    invalidTimeZone
    ${"Mars/Olympus"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid timezone $invalidTimeZone",
    ({ invalidTimeZone }) => {
      expect(
        convertZonedToZoned(
          "2024-02-29T14:30:45+00:00[UTC]",
          invalidTimeZone as never,
        ),
      ).toBe("");
    },
  );

  for (const { timeZone, value } of sameInstantBattleCases) {
    it(`converts a battle-test zoned datetime from ${timeZone} to UTC`, () => {
      expect(parseZonedTimezone(convertZonedToZoned(value, "UTC"))).toBe("UTC");
    });
  }
});
