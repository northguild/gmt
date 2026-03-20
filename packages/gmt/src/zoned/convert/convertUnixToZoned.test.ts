import { parseZonedTimezone } from "../parse";
import { battleTestTimeZones } from "../test/timezoneFixtures";
import { convertUnixToZoned } from "./convertUnixToZoned";

describe("convertUnixToZoned", () => {
  it.each`
    value            | timeZone              | unit              | expected
    ${0}             | ${"UTC"}              | ${"milliseconds"} | ${"1970-01-01T00:00:00+00:00[UTC]"}
    ${0}             | ${"UTC"}              | ${"seconds"}      | ${"1970-01-01T00:00:00+00:00[UTC]"}
    ${1709197200000} | ${"America/New_York"} | ${"milliseconds"} | ${"2024-02-29T04:00:00-05:00[America/New_York]"}
    ${1709197200}    | ${"America/New_York"} | ${"seconds"}      | ${"2024-02-29T04:00:00-05:00[America/New_York]"}
  `(
    "returns $expected for $value in $timeZone using $unit",
    ({ value, timeZone, unit, expected }) => {
      expect(convertUnixToZoned(value, timeZone, unit)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${NaN}
    ${Infinity}
    ${-Infinity}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid unix value $invalidValue",
    ({ invalidValue }) => {
      expect(convertUnixToZoned(invalidValue as never, "UTC")).toBe("");
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
      expect(convertUnixToZoned(0, invalidTimeZone as never)).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"minutes"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid unit $invalidUnit",
    ({ invalidUnit }) => {
      expect(convertUnixToZoned(0, "UTC", invalidUnit as never)).toBe("");
    },
  );

  for (const timeZone of battleTestTimeZones) {
    it(`returns a zoned datetime in battle-test timezone ${timeZone}`, () => {
      const value = convertUnixToZoned(1709217045000, timeZone);
      expect(parseZonedTimezone(value)).toBe(timeZone);
    });
  }
});
