import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "../../plain/validate";
import {
  battleTestTimeZones,
  fixedNowInstant,
  TomorrowTimeZone,
  YesterdayTimeZone,
} from "../../test";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { getZonedToday } from "./getZonedToday";

describe("getZonedToday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T00:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // yesterday tomorrow tests
  it.each`
    timeZone             | expected
    ${"UTC"}             | ${"2024-02-29"}
    ${YesterdayTimeZone} | ${"2024-02-28"}
    ${TomorrowTimeZone}  | ${"2024-02-29"}
  `("returns $expected for timeZone $timeZone", ({ timeZone, expected }) => {
    const value = getZonedToday(timeZone);
    expect(value).toBe(expected);
  });

  it.each`
    timeZone                 | expected
    ${"UTC"}                 | ${"2024-02-29"}
    ${"GMT"}                 | ${"2024-02-29"}
    ${"Etc/GMT"}             | ${"2024-02-29"}
    ${"Europe/Lisbon"}       | ${"2024-02-29"}
    ${"Europe/Dublin"}       | ${"2024-02-29"}
    ${"Europe/Berlin"}       | ${"2024-02-29"}
    ${"Europe/Helsinki"}     | ${"2024-02-29"}
    ${"Europe/Istanbul"}     | ${"2024-02-29"}
    ${"Asia/Kolkata"}        | ${"2024-02-29"}
    ${"Asia/Kathmandu"}      | ${"2024-02-29"}
    ${"Asia/Shanghai"}       | ${"2024-02-29"}
    ${"Australia/Lord_Howe"} | ${"2024-02-29"}
    ${"Pacific/Chatham"}     | ${"2024-02-29"}
    ${TomorrowTimeZone}      | ${"2024-02-29"}
    ${YesterdayTimeZone}     | ${"2024-02-28"}
    ${"America/New_York"}    | ${"2024-02-28"}
    ${"America/Chicago"}     | ${"2024-02-28"}
    ${"America/Phoenix"}     | ${"2024-02-28"}
  `(
    "returns an exact ISO date string for valid timeZone $timeZone",
    ({ timeZone, expected }) => {
      const value = getZonedToday(timeZone);

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
    "returns an empty string for invalid timeZone $invalidTimeZone",
    ({ invalidTimeZone }) => {
      expect(getZonedToday(invalidTimeZone as never)).toBe("");
    },
  );

  for (const timeZone of battleTestTimeZones) {
    it(`returns an exact ISO date for battle-test timeZone ${timeZone}`, () => {
      const expected = Temporal.Instant.from(fixedNowInstant)
        .toZonedDateTimeISO(timeZone)
        .toPlainDate()
        .toString();

      expect(getZonedToday(timeZone)).toBe(expected);
    });
  }

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    const result = getZonedToday("America/New_York");
    expect(result).toBe("");
  });
});
