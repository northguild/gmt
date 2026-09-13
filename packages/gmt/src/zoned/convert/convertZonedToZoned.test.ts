import {
  sameInstantBattleCases,
  MustTestDstTimeZones,
  battleTestTimeZones,
} from "../../test";
import { parseTimeZoneFromZoned } from "../parse";
import { convertZonedToZoned } from "./convertZonedToZoned";

// Expected values per battle-test timeZone, verified against @js-temporal/polyfill.
const sameInstantByZone = {
  UTC: "2024-02-29T00:00:00+00:00[UTC]",
  GMT: "2024-02-29T00:00:00+00:00[GMT]",
  "Etc/GMT": "2024-02-29T00:00:00+00:00[Etc/GMT]",
  "America/Nome": "2024-02-28T15:00:00-09:00[America/Nome]",
  "Asia/Anadyr": "2024-02-29T12:00:00+12:00[Asia/Anadyr]",
  "Europe/Lisbon": "2024-02-29T00:00:00+00:00[Europe/Lisbon]",
  "Europe/Dublin": "2024-02-29T00:00:00+00:00[Europe/Dublin]",
  "Europe/Berlin": "2024-02-29T01:00:00+01:00[Europe/Berlin]",
  "Europe/Helsinki": "2024-02-29T02:00:00+02:00[Europe/Helsinki]",
  "Europe/Istanbul": "2024-02-29T03:00:00+03:00[Europe/Istanbul]",
  "Asia/Kolkata": "2024-02-29T05:30:00+05:30[Asia/Kolkata]",
  "Asia/Kathmandu": "2024-02-29T05:45:00+05:45[Asia/Kathmandu]",
  "Asia/Shanghai": "2024-02-29T08:00:00+08:00[Asia/Shanghai]",
  "Australia/Lord_Howe": "2024-02-29T11:00:00+11:00[Australia/Lord_Howe]",
  "Pacific/Chatham": "2024-02-29T13:45:00+13:45[Pacific/Chatham]",
  "Pacific/Apia": "2024-02-29T13:00:00+13:00[Pacific/Apia]",
  "Pacific/Niue": "2024-02-28T13:00:00-11:00[Pacific/Niue]",
  "America/New_York": "2024-02-28T19:00:00-05:00[America/New_York]",
  "America/Chicago": "2024-02-28T18:00:00-06:00[America/Chicago]",
  "America/Phoenix": "2024-02-28T17:00:00-07:00[America/Phoenix]",
} satisfies Record<keyof typeof MustTestDstTimeZones, string>;

describe("convertZonedToZoned", () => {
  it.each`
    value                                            | timeZone              | expected
    ${"2024-02-29T09:30:45-05:00[America/New_York]"} | ${"UTC"}              | ${"2024-02-29T14:30:45+00:00[UTC]"}
    ${"2024-02-29T14:30:45+00:00[UTC]"}              | ${"America/New_York"} | ${"2024-02-29T09:30:45-05:00[America/New_York]"}
  `(
    "converts $value to $expected in $timeZone",
    ({ value, timeZone, expected }) => {
      expect(convertZonedToZoned(value, timeZone)).toBe(expected);
    },
  );

  it.each(
    battleTestTimeZones.map((timeZone) => ({
      value: "2024-02-29T00:00:00+00:00[UTC]",
      timeZone,
      expected: sameInstantByZone[timeZone],
    })),
  )(
    "converts $value to $expected in battle-test $timeZone",
    ({ value, timeZone, expected }) => {
      expect(convertZonedToZoned(value, timeZone)).toBe(expected);
    },
  );

  it.each(
    battleTestTimeZones.map((timeZone) => ({
      value: sameInstantByZone[timeZone],
      timeZone: "UTC",
      expected: "2024-02-29T00:00:00+00:00[UTC]",
    })),
  )(
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
