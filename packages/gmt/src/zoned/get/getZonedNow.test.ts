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
    timeZone                 | expected
    ${"UTC"}                 | ${"2024-02-29T00:00:00.000+00:00[UTC]"}
    ${"GMT"}                 | ${"2024-02-29T00:00:00.000+00:00[GMT]"}
    ${"Etc/GMT"}             | ${"2024-02-29T00:00:00.000+00:00[Etc/GMT]"}
    ${"Europe/Lisbon"}       | ${"2024-02-29T00:00:00.000+00:00[Europe/Lisbon]"}
    ${"Europe/Dublin"}       | ${"2024-02-29T00:00:00.000+00:00[Europe/Dublin]"}
    ${"Europe/Berlin"}       | ${"2024-02-29T01:00:00.000+01:00[Europe/Berlin]"}
    ${"Europe/Helsinki"}     | ${"2024-02-29T02:00:00.000+02:00[Europe/Helsinki]"}
    ${"Europe/Istanbul"}     | ${"2024-02-29T03:00:00.000+03:00[Europe/Istanbul]"}
    ${"Asia/Kolkata"}        | ${"2024-02-29T05:30:00.000+05:30[Asia/Kolkata]"}
    ${"Asia/Kathmandu"}      | ${"2024-02-29T05:45:00.000+05:45[Asia/Kathmandu]"}
    ${"Asia/Shanghai"}       | ${"2024-02-29T08:00:00.000+08:00[Asia/Shanghai]"}
    ${"Australia/Lord_Howe"} | ${"2024-02-29T11:00:00.000+11:00[Australia/Lord_Howe]"}
    ${"Pacific/Chatham"}     | ${"2024-02-29T13:45:00.000+13:45[Pacific/Chatham]"}
    ${"Pacific/Apia"}        | ${"2024-02-29T13:00:00.000+13:00[Pacific/Apia]"}
    ${"Pacific/Niue"}        | ${"2024-02-28T13:00:00.000-11:00[Pacific/Niue]"}
    ${"America/New_York"}    | ${"2024-02-28T19:00:00.000-05:00[America/New_York]"}
    ${"America/Chicago"}     | ${"2024-02-28T18:00:00.000-06:00[America/Chicago]"}
    ${"America/Phoenix"}     | ${"2024-02-28T17:00:00.000-07:00[America/Phoenix]"}
  `(
    "returns an exact zoned datetime string for valid timezone $timeZone",
    ({ timeZone, expected }) => {
      const value = getZonedNow(timeZone);

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
