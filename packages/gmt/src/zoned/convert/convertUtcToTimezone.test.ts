import { parseZonedTimezone } from "../parse";
import { battleTestTimeZones } from "../test/timezoneFixtures";
import { convertUtcToTimezone } from "./convertUtcToTimezone";

describe("convertUtcToTimezone", () => {
  it.each`
    value                     | timeZone              | expected
    ${"2024-02-29T14:30:45Z"} | ${"UTC"}              | ${"2024-02-29T14:30:45+00:00[UTC]"}
    ${"2024-02-29T14:30:45Z"} | ${"America/New_York"} | ${"2024-02-29T09:30:45-05:00[America/New_York]"}
  `(
    "returns $expected for $value in $timeZone",
    ({ value, timeZone, expected }) => {
      expect(convertUtcToTimezone(value, timeZone)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"invalid"}
    ${"2024-02-29T14:30:45"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid UTC datetime $invalidValue",
    ({ invalidValue }) => {
      expect(convertUtcToTimezone(invalidValue as never, "UTC")).toBe("");
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
        convertUtcToTimezone("2024-02-29T14:30:45Z", invalidTimeZone as never),
      ).toBe("");
    },
  );

  for (const timeZone of battleTestTimeZones) {
    it(`converts UTC to battle-test timezone ${timeZone}`, () => {
      expect(
        parseZonedTimezone(
          convertUtcToTimezone("2024-02-29T14:30:45Z", timeZone),
        ),
      ).toBe(timeZone);
    });
  }
});
