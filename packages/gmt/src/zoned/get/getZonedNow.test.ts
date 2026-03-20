import { Temporal } from "@js-temporal/polyfill";
import { parseZonedTimezone } from "../parse";
import { battleTestTimeZones, fixedNowInstant } from "../test/timezoneFixtures";
import { getZonedNow } from "./getZonedNow";

describe("getZonedNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T00:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each`
    timeZone
    ${"UTC"}
    ${"America/New_York"}
  `(
    "returns an exact zoned datetime string for valid timezone $timeZone",
    ({ timeZone }) => {
      const value = getZonedNow(timeZone);

      const expected = Temporal.Instant.from(fixedNowInstant)
        .toZonedDateTimeISO(timeZone)
        .toString({ smallestUnit: "milliseconds" });

      const normalizedValue = Temporal.ZonedDateTime.from(value).toString({
        smallestUnit: "milliseconds",
      });

      expect(normalizedValue).toBe(expected);
      expect(parseZonedTimezone(value)).toBe(timeZone);
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
      expect(getZonedNow(invalidTimeZone as never)).toBe("");
    },
  );

  for (const timeZone of battleTestTimeZones) {
    it(`returns an exact zoned datetime for battle-test timezone ${timeZone}`, () => {
      const value = getZonedNow(timeZone);

      const expected = Temporal.Instant.from(fixedNowInstant)
        .toZonedDateTimeISO(timeZone)
        .toString({ smallestUnit: "milliseconds" });

      const normalizedValue = Temporal.ZonedDateTime.from(value).toString({
        smallestUnit: "milliseconds",
      });

      expect(normalizedValue).toBe(expected);
      expect(parseZonedTimezone(value)).toBe(timeZone);
    });
  }
});
