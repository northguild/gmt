import { battleTestTimeZones, MustTestDstTimeZones } from "../../test";
import { parseTimeZoneFromZoned } from "../../zoned/parse";
import { convertUtcToZoned } from "./convertUtcToZoned";

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

describe("convertUtcToZoned", () => {
  it.each(
    battleTestTimeZones.map((timeZone) => ({
      value: "2024-02-29T00:00:00Z",
      timeZone,
      expected: sameInstantByZone[timeZone],
    })),
  )(
    "returns $expected for $value in $timeZone",
    ({ value, timeZone, expected }) => {
      expect(convertUtcToZoned(value, timeZone)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"invalid"}
    ${"2024-02-29T14:30:45"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid UTC datetime $invalidValue",
    ({ invalidValue }) => {
      expect(convertUtcToZoned(invalidValue as never, "UTC")).toBe("");
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
        convertUtcToZoned("2024-02-29T14:30:45Z", invalidTimeZone as never),
      ).toBe("");
    },
  );

  for (const timeZone of battleTestTimeZones) {
    it(`converts UTC to battle-test timeZone ${timeZone}`, () => {
      expect(
        parseTimeZoneFromZoned(
          convertUtcToZoned("2024-02-29T14:30:45Z", timeZone),
        ),
      ).toBe(timeZone);
    });
  }
});
