import { MustTestDstTimeZones, battleTestTimeZones } from "../../test";
import { hasDaylightSaving } from ".";

// Expected values per battle-test timeZone, verified against @js-temporal/polyfill.
const hasDaylightSavingByZone = {
  UTC: false,
  GMT: false,
  "Etc/GMT": false,
  "America/Nome": true,
  "Asia/Anadyr": false,
  "Europe/Lisbon": true,
  "Europe/Dublin": true,
  "Europe/Berlin": true,
  "Europe/Helsinki": true,
  "Europe/Istanbul": false,
  "Asia/Kolkata": false,
  "Asia/Kathmandu": false,
  "Asia/Shanghai": false,
  "Australia/Lord_Howe": true,
  "Pacific/Chatham": true,
  "Pacific/Apia": false,
  "Pacific/Niue": false,
  "America/New_York": true,
  "America/Chicago": true,
  "America/Phoenix": false,
} satisfies Record<keyof typeof MustTestDstTimeZones, boolean>;

describe("hasDaylightSaving", () => {
  it.each`
    timeZone              | expected
    ${"America/Chicago"}  | ${true}
    ${"America/New_York"} | ${true}
    ${"Europe/Berlin"}    | ${true}
    ${"Australia/Sydney"} | ${true}
    ${"Asia/Tokyo"}       | ${false}
    ${"UTC"}              | ${false}
  `("returns $expected for $timeZone", ({ timeZone, expected }) => {
    expect(hasDaylightSaving(timeZone)).toBe(expected);
  });

  it.each`
    timeZone
    ${"Not/AZone"}
    ${""}
    ${null}
    ${undefined}
    ${123}
    ${true}
  `("returns false for invalid timeZone $timeZone", ({ timeZone }) => {
    expect(hasDaylightSaving(timeZone as never)).toBe(false);
  });

  it.each(
    battleTestTimeZones.map((timeZone) => ({
      timeZone,
      expected: hasDaylightSavingByZone[timeZone],
    })),
  )(
    "returns $expected for battle-test timeZone $timeZone",
    ({ timeZone, expected }) => {
      expect(hasDaylightSaving(timeZone)).toBe(expected);
    },
  );

  it.each`
    timeZone           | expected
    ${"Asia/Calcutta"} | ${false}
  `(
    "returns $expected for legacy alias timeZone $timeZone",
    ({ timeZone, expected }) => {
      expect(hasDaylightSaving(timeZone)).toBe(expected);
    },
  );
});
