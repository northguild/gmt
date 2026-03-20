import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "../../plain/validate";
import { battleTestTimeZones, fixedNowInstant } from "../test/timezoneFixtures";
import { getZonedToday } from "./getZonedToday";

describe("getZonedToday", () => {
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
    "returns an exact ISO date string for valid timezone $timeZone",
    ({ timeZone }) => {
      const value = getZonedToday(timeZone);

      const expected = Temporal.Instant.from(fixedNowInstant)
        .toZonedDateTimeISO(timeZone)
        .toPlainDate()
        .toString();

      expect(value).toBe(expected);
      expect(isValidDate(value)).toBe(true);
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
      expect(getZonedToday(invalidTimeZone as never)).toBe("");
    },
  );

  for (const timeZone of battleTestTimeZones) {
    it(`returns an exact ISO date for battle-test timezone ${timeZone}`, () => {
      const expected = Temporal.Instant.from(fixedNowInstant)
        .toZonedDateTimeISO(timeZone)
        .toPlainDate()
        .toString();

      expect(getZonedToday(timeZone)).toBe(expected);
    });
  }
});
