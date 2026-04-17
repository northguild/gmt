import { sameInstantBattleCases } from "../../test";
import { parseTimeZoneFromZoned } from "../parse";
import { convertZonedToZoned } from "./convertZonedToZoned";

describe("convertZonedToZoned", () => {
  it.each`
    value                                               | timeZone                 | expected
    ${"2024-02-29T09:30:45-05:00[America/New_York]"}    | ${"UTC"}                 | ${"2024-02-29T14:30:45+00:00[UTC]"}
    ${"2024-02-29T14:30:45+00:00[UTC]"}                 | ${"America/New_York"}    | ${"2024-02-29T09:30:45-05:00[America/New_York]"}
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${"America/New_York"}    | ${"2024-02-28T19:00:00-05:00[America/New_York]"}
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${"Asia/Shanghai"}       | ${"2024-02-29T08:00:00+08:00[Asia/Shanghai]"}
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${"Asia/Kolkata"}        | ${"2024-02-29T05:30:00+05:30[Asia/Kolkata]"}
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${"Asia/Kathmandu"}      | ${"2024-02-29T05:45:00+05:45[Asia/Kathmandu]"}
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${"Pacific/Chatham"}     | ${"2024-02-29T13:45:00+13:45[Pacific/Chatham]"}
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${"Pacific/Apia"}        | ${"2024-02-29T13:00:00+13:00[Pacific/Apia]"}
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${"Pacific/Niue"}        | ${"2024-02-28T13:00:00-11:00[Pacific/Niue]"}
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${"UTC"}                 | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${"Etc/GMT"}             | ${"2024-02-29T00:00:00+00:00[Etc/GMT]"}
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${"Europe/Helsinki"}     | ${"2024-02-29T02:00:00+02:00[Europe/Helsinki]"}
    ${"2024-02-28T19:00:00-05:00[America/New_York]"}    | ${"UTC"}                 | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-29T08:00:00+08:00[Asia/Shanghai]"}       | ${"UTC"}                 | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-29T05:30:00+05:30[Asia/Kolkata]"}        | ${"UTC"}                 | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-29T05:45:00+05:45[Asia/Kathmandu]"}      | ${"UTC"}                 | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-29T13:45:00+13:45[Pacific/Chatham]"}     | ${"UTC"}                 | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-29T13:00:00+13:00[Pacific/Apia]"}        | ${"UTC"}                 | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-28T13:00:00-11:00[Pacific/Niue]"}        | ${"UTC"}                 | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-29T00:00:00+00:00[Etc/GMT]"}             | ${"UTC"}                 | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-29T02:00:00+02:00[Europe/Helsinki]"}     | ${"UTC"}                 | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${"GMT"}                 | ${"2024-02-29T00:00:00+00:00[GMT]"}
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${"Europe/Lisbon"}       | ${"2024-02-29T00:00:00+00:00[Europe/Lisbon]"}
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${"Europe/Dublin"}       | ${"2024-02-29T00:00:00+00:00[Europe/Dublin]"}
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${"Europe/Berlin"}       | ${"2024-02-29T01:00:00+01:00[Europe/Berlin]"}
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${"Europe/Istanbul"}     | ${"2024-02-29T03:00:00+03:00[Europe/Istanbul]"}
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${"Australia/Lord_Howe"} | ${"2024-02-29T11:00:00+11:00[Australia/Lord_Howe]"}
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${"America/Chicago"}     | ${"2024-02-28T18:00:00-06:00[America/Chicago]"}
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${"America/Phoenix"}     | ${"2024-02-28T17:00:00-07:00[America/Phoenix]"}
    ${"2024-02-29T00:00:00+00:00[GMT]"}                 | ${"UTC"}                 | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-29T00:00:00+00:00[Europe/Lisbon]"}       | ${"UTC"}                 | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-29T00:00:00+00:00[Europe/Dublin]"}       | ${"UTC"}                 | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-29T01:00:00+01:00[Europe/Berlin]"}       | ${"UTC"}                 | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-29T03:00:00+03:00[Europe/Istanbul]"}     | ${"UTC"}                 | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-29T11:00:00+11:00[Australia/Lord_Howe]"} | ${"UTC"}                 | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-28T18:00:00-06:00[America/Chicago]"}     | ${"UTC"}                 | ${"2024-02-29T00:00:00+00:00[UTC]"}
    ${"2024-02-28T17:00:00-07:00[America/Phoenix]"}     | ${"UTC"}                 | ${"2024-02-29T00:00:00+00:00[UTC]"}
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
    "returns an empty string for invalid timeZone $invalidTimeZone",
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
      expect(parseTimeZoneFromZoned(convertZonedToZoned(value, "UTC"))).toBe(
        "UTC",
      );
    });
  }
});
