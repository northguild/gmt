import { parseZonedTimezone } from "../parse";
import { battleTestTimeZones } from "../test/timezoneFixtures";
import { getZonedDateTime } from "./getZonedDateTime";

describe("getZonedDateTime", () => {
  it.each`
    value                    | timeZone              | expected
    ${"2024-02-29T14:30:45"} | ${"UTC"}              | ${"2024-02-29T14:30:45+00:00[UTC]"}
    ${"2024-02-29T14:30:45"} | ${"America/New_York"} | ${"2024-02-29T14:30:45-05:00[America/New_York]"}
  `(
    "returns $expected for $value in $timeZone",
    ({ value, timeZone, expected }) => {
      expect(getZonedDateTime(value, timeZone)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid datetime $invalidValue",
    ({ invalidValue }) => {
      expect(getZonedDateTime(invalidValue as never, "UTC")).toBe("");
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
        getZonedDateTime("2024-02-29T14:30:45", invalidTimeZone as never),
      ).toBe("");
    },
  );

  for (const timeZone of battleTestTimeZones) {
    it(`creates a zoned datetime in battle-test timezone ${timeZone}`, () => {
      const value = getZonedDateTime("2024-02-29T00:00:00", timeZone);
      expect(value).not.toBe("");
      expect(parseZonedTimezone(value)).toBe(timeZone);
    });
  }
});
