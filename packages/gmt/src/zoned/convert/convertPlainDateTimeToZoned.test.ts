import {
  battleTestTimeZones,
  TomorrowTimeZone,
  YesterdayTimeZone,
} from "../../test";
import { parseTimeZoneFromZoned } from "../parse";
import { convertPlainDateTimeToZoned } from "./convertPlainDateTimeToZoned";

describe("convertPlainDateTimeToZoned", () => {
  it.each`
    value                    | timeZone              | expected
    ${"2024-02-29T14:30:45"} | ${"UTC"}              | ${"2024-02-29T14:30:45.000+00:00[UTC]"}
    ${"2024-02-29T14:30:45"} | ${"America/New_York"} | ${"2024-02-29T14:30:45.000-05:00[America/New_York]"}
  `(
    "returns $expected for $value in $timeZone",
    ({ value, timeZone, expected }) => {
      expect(convertPlainDateTimeToZoned(value, timeZone)).toBe(expected);
    },
  );

  // yesterday tomorrow tests
  it.each`
    timeZone             | expected
    ${"UTC"}             | ${"2024-02-29T14:30:45.000+00:00[UTC]"}
    ${YesterdayTimeZone} | ${"2024-02-29T14:30:45.000-11:00[Pacific/Niue]"}
    ${TomorrowTimeZone}  | ${"2024-02-29T14:30:45.000+13:00[Pacific/Apia]"}
  `("returns $expected for timeZone $timeZone", ({ timeZone, expected }) => {
    expect(convertPlainDateTimeToZoned("2024-02-29T14:30:45", timeZone)).toBe(
      expected,
    );
  });

  // smallestUnit option tests
  it.each`
    smallestUnit     | expected
    ${"second"}      | ${"2024-02-29T14:30:45+00:00[UTC]"}
    ${"minute"}      | ${"2024-02-29T14:30+00:00[UTC]"}
    ${"millisecond"} | ${"2024-02-29T14:30:45.123+00:00[UTC]"}
    ${"microsecond"} | ${"2024-02-29T14:30:45.123456+00:00[UTC]"}
    ${"nanosecond"}  | ${"2024-02-29T14:30:45.123456789+00:00[UTC]"}
  `(
    "returns $expected with smallestUnit $smallestUnit",
    ({ smallestUnit, expected }) => {
      expect(
        convertPlainDateTimeToZoned("2024-02-29T14:30:45.123456789", "UTC", {
          smallestUnit,
        }),
      ).toBe(expected);
    },
  );

  it.each`
    timeZone                 | expected
    ${"UTC"}                 | ${"2024-02-29T14:30:45.000+00:00[UTC]"}
    ${"GMT"}                 | ${"2024-02-29T14:30:45.000+00:00[GMT]"}
    ${"Etc/GMT"}             | ${"2024-02-29T14:30:45.000+00:00[Etc/GMT]"}
    ${"Europe/Lisbon"}       | ${"2024-02-29T14:30:45.000+00:00[Europe/Lisbon]"}
    ${"Europe/Dublin"}       | ${"2024-02-29T14:30:45.000+00:00[Europe/Dublin]"}
    ${"Europe/Berlin"}       | ${"2024-02-29T14:30:45.000+01:00[Europe/Berlin]"}
    ${"Europe/Helsinki"}     | ${"2024-02-29T14:30:45.000+02:00[Europe/Helsinki]"}
    ${"Europe/Istanbul"}     | ${"2024-02-29T14:30:45.000+03:00[Europe/Istanbul]"}
    ${"Asia/Kolkata"}        | ${"2024-02-29T14:30:45.000+05:30[Asia/Kolkata]"}
    ${"Asia/Kathmandu"}      | ${"2024-02-29T14:30:45.000+05:45[Asia/Kathmandu]"}
    ${"Asia/Shanghai"}       | ${"2024-02-29T14:30:45.000+08:00[Asia/Shanghai]"}
    ${"Australia/Lord_Howe"} | ${"2024-02-29T14:30:45.000+11:00[Australia/Lord_Howe]"}
    ${"Pacific/Chatham"}     | ${"2024-02-29T14:30:45.000+13:45[Pacific/Chatham]"}
    ${"America/New_York"}    | ${"2024-02-29T14:30:45.000-05:00[America/New_York]"}
    ${"America/Chicago"}     | ${"2024-02-29T14:30:45.000-06:00[America/Chicago]"}
    ${"America/Phoenix"}     | ${"2024-02-29T14:30:45.000-07:00[America/Phoenix]"}
  `(
    "attaches $timeZone offset to the plain datetime 2024-02-29T14:30:45",
    ({ timeZone, expected }: { timeZone: string; expected: string }) => {
      expect(convertPlainDateTimeToZoned("2024-02-29T14:30:45", timeZone)).toBe(
        expected,
      );
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
      expect(convertPlainDateTimeToZoned(invalidValue as never, "UTC")).toBe(
        "",
      );
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
      expect(
        convertPlainDateTimeToZoned(
          "2024-02-29T14:30:45",
          invalidTimeZone as never,
        ),
      ).toBe("");
    },
  );

  for (const timeZone of battleTestTimeZones) {
    it(`creates a zoned datetime in battle-test timeZone ${timeZone}`, () => {
      const value = convertPlainDateTimeToZoned(
        "2024-02-29T00:00:00",
        timeZone,
      );
      expect(value).not.toBe("");
      expect(parseTimeZoneFromZoned(value)).toBe(timeZone);
    });
  }
});
