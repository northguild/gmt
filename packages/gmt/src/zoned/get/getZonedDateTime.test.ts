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
    timeZone                 | expected
    ${"UTC"}                 | ${"2024-02-29T14:30:45+00:00[UTC]"}
    ${"GMT"}                 | ${"2024-02-29T14:30:45+00:00[GMT]"}
    ${"Etc/GMT"}             | ${"2024-02-29T14:30:45+00:00[Etc/GMT]"}
    ${"Europe/Lisbon"}       | ${"2024-02-29T14:30:45+00:00[Europe/Lisbon]"}
    ${"Europe/Dublin"}       | ${"2024-02-29T14:30:45+00:00[Europe/Dublin]"}
    ${"Europe/Berlin"}       | ${"2024-02-29T14:30:45+01:00[Europe/Berlin]"}
    ${"Europe/Helsinki"}     | ${"2024-02-29T14:30:45+02:00[Europe/Helsinki]"}
    ${"Europe/Istanbul"}     | ${"2024-02-29T14:30:45+03:00[Europe/Istanbul]"}
    ${"Asia/Kolkata"}        | ${"2024-02-29T14:30:45+05:30[Asia/Kolkata]"}
    ${"Asia/Kathmandu"}      | ${"2024-02-29T14:30:45+05:45[Asia/Kathmandu]"}
    ${"Asia/Shanghai"}       | ${"2024-02-29T14:30:45+08:00[Asia/Shanghai]"}
    ${"Australia/Lord_Howe"} | ${"2024-02-29T14:30:45+11:00[Australia/Lord_Howe]"}
    ${"Pacific/Chatham"}     | ${"2024-02-29T14:30:45+13:45[Pacific/Chatham]"}
    ${"Pacific/Apia"}        | ${"2024-02-29T14:30:45+13:00[Pacific/Apia]"}
    ${"Pacific/Niue"}        | ${"2024-02-29T14:30:45-11:00[Pacific/Niue]"}
    ${"America/New_York"}    | ${"2024-02-29T14:30:45-05:00[America/New_York]"}
    ${"America/Chicago"}     | ${"2024-02-29T14:30:45-06:00[America/Chicago]"}
    ${"America/Phoenix"}     | ${"2024-02-29T14:30:45-07:00[America/Phoenix]"}
  `(
    "attaches $timeZone offset to the plain datetime 2024-02-29T14:30:45",
    ({ timeZone, expected }: { timeZone: string; expected: string }) => {
      expect(getZonedDateTime("2024-02-29T14:30:45", timeZone)).toBe(expected);
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
