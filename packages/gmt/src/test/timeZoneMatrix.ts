import { Temporal } from "@js-temporal/polyfill";
import { MustTestLocales } from "./localeMatrix";

// Absolute must test timezones
export const TomorrowTimeZone = "Pacific/Apia";
export const YesterdayTimeZone = "Pacific/Niue";

// GMT offsets for extreme edge case timezones (standard time, not DST)
export const TomorrowTimeZoneGmtOffset = "+13:00";
export const YesterdayTimeZoneGmtOffset = "-11:00";

// Note: Pacific/Apia and Pacific/Niue do not observe DST at the instants used in these tests

/**
 * Canonical timeZone IDs that stress offset and date-boundary behavior.
 *
 * Example lookups:
 * - MustTestDstTimeZones["UTC"] => "UTC"
 * - MustTestDstTimeZones["America/New_York"] => "America/New_York"
 * - MustTestDstTimeZones["Europe/Helsinki"] => "Europe/Helsinki"
 */
export const MustTestDstTimeZones = {
  UTC: "UTC",
  GMT: "GMT",
  "Etc/GMT": "Etc/GMT",
  "America/Nome": "America/Nome", // This is Yesterday when it's Today in New York
  "Asia/Anadyr": "Asia/Anadyr", // This is Tomorrow when it's Today in New York
  "Europe/Lisbon": "Europe/Lisbon",
  "Europe/Dublin": "Europe/Dublin",
  "Europe/Berlin": "Europe/Berlin",
  "Europe/Helsinki": "Europe/Helsinki",
  "Europe/Istanbul": "Europe/Istanbul",
  "Asia/Kolkata": "Asia/Kolkata",
  "Asia/Kathmandu": "Asia/Kathmandu",
  "Asia/Shanghai": "Asia/Shanghai",
  "Australia/Lord_Howe": "Australia/Lord_Howe",
  "Pacific/Chatham": "Pacific/Chatham",
  "Pacific/Apia": TomorrowTimeZone,
  "Pacific/Niue": YesterdayTimeZone,
  "America/New_York": "America/New_York",
  "America/Chicago": "America/Chicago",
  "America/Phoenix": "America/Phoenix",
} as const;

/**
 * Locale to representative timeZone mapping for locale-aware APIs.
 *
 * Examples from this map:
 * - MustTestLocaleTimezones[MustTestLocales.enUS] => "America/New_York"
 *
 * Related matrix examples used by timeZone-centric tests:
 * - MustTestDstTimeZones["UTC"] => "UTC"
 * - MustTestDstTimeZones["Europe/Helsinki"] => "Europe/Helsinki"
 * - MustTestDstTimeZones["Pacific/Apia"] => "Pacific/Apia"
 * - MustTestDstTimeZones["Pacific/Niue"] => "Pacific/Niue"
 */
export const MustTestLocaleTimezones = {
  [MustTestLocales.enUS]: "America/New_York",
  [MustTestLocales.enGB]: "Europe/London",
  [MustTestLocales.deDE]: "Europe/Berlin",
  [MustTestLocales.frFR]: "Europe/Paris",
  [MustTestLocales.esES]: "Europe/Madrid",
  [MustTestLocales.itIT]: "Europe/Rome",
  [MustTestLocales.ptPT]: "Europe/Lisbon",
  [MustTestLocales.svSE]: "Europe/Stockholm",
  [MustTestLocales.isIS]: "Atlantic/Reykjavik",
  [MustTestLocales.zhCN]: "Asia/Shanghai",
  [MustTestLocales.zhTW]: "Asia/Taipei",
  [MustTestLocales.jaJP]: "Asia/Tokyo",
  [MustTestLocales.koKR]: "Asia/Seoul",
  [MustTestLocales.arSA]: "Asia/Riyadh",
  [MustTestLocales.heIL]: "Asia/Jerusalem",
  [MustTestLocales.ruRU]: "Europe/Moscow",
  [MustTestLocales.trTR]: "Europe/Istanbul",
} as const;

export const LocaleTimezones = {
  "America/New_York": "America/New_York",
  "Europe/London": "Europe/London",
  "Europe/Berlin": "Europe/Berlin",
  "Europe/Paris": "Europe/Paris",
  "Europe/Madrid": "Europe/Madrid",
  "Europe/Rome": "Europe/Rome",
  "Europe/Lisbon": "Europe/Lisbon",
  "Europe/Stockholm": "Europe/Stockholm",
  "Atlantic/Reykjavik": "Atlantic/Reykjavik",
  "Asia/Shanghai": "Asia/Shanghai",
  "Asia/Taipei": "Asia/Taipei",
  "Asia/Tokyo": "Asia/Tokyo",
  "Asia/Seoul": "Asia/Seoul",
  "Asia/Riyadh": "Asia/Riyadh",
  "Asia/Jerusalem": "Asia/Jerusalem",
  "Europe/Moscow": "Europe/Moscow",
  "Europe/Istanbul": "Europe/Istanbul",
};

export const TestTimezones = {
  ...MustTestDstTimeZones,
  ...LocaleTimezones,
};

// Core timeZone matrix used by zoned tests.
// Includes DST, UTC-like, negative offset, half-hour, and quarter-hour zones.
export const battleTestTimeZones = Object.values(MustTestDstTimeZones);

// Alias-friendly matrix used by timeZone validators.
// Includes legacy Asia/Calcutta which should validate even if not preferred.
export const validOnlyBattleTestTimeZones = [
  ...battleTestTimeZones,
  "Asia/Calcutta",
] as const;

// Shared modern instant used to prove zone conversions preserve exact instants.
const battleTestInstant = Temporal.Instant.from("2024-02-29T00:00:00Z");
// Unix epoch instant used for historical offset behavior coverage.
const unixEpochInstant = Temporal.Instant.fromEpochMilliseconds(0);

/**
 * Same instant represented in every battle-test timeZone.
 * Use this when asserting conversion parity across zones.
 *
 * Example rows (for battleTestInstant = 2024-02-29T00:00:00Z):
 * - UTC -> 2024-02-29T00:00:00+00:00[UTC]
 * - America/New_York -> 2024-02-28T19:00:00-05:00[America/New_York]
 * - Europe/Helsinki -> 2024-02-29T02:00:00+02:00[Europe/Helsinki]
 * - Pacific/Apia -> 2024-02-29T13:00:00+13:00[Pacific/Apia]
 * - Pacific/Niue -> 2024-02-28T13:00:00-11:00[Pacific/Niue]
 */
export const sameInstantBattleCases = battleTestTimeZones.map((timeZone) => ({
  timeZone,
  value: battleTestInstant.toZonedDateTimeISO(timeZone).toString(),
  unixMilliseconds: Number(battleTestInstant.epochMilliseconds),
  unixSeconds: Math.floor(Number(battleTestInstant.epochMilliseconds) / 1000),
  utc: battleTestInstant.toString(),
}));

/**
 * Unix epoch represented in every battle-test timeZone.
 * Use this to catch historical timeZone-offset differences.
 *
 * Example rows (for unixEpochInstant = 1970-01-01T00:00:00Z):
 * - UTC -> 1970-01-01T00:00:00+00:00[UTC]
 * - America/New_York -> 1969-12-31T19:00:00-05:00[America/New_York]
 * - Europe/Helsinki -> 1970-01-01T02:00:00+02:00[Europe/Helsinki]
 * - Pacific/Apia -> 1969-12-31T13:00:00-11:00[Pacific/Apia]
 * - Pacific/Niue -> 1969-12-31T13:00:00-11:00[Pacific/Niue]
 */
export const unixEpochBattleCases = battleTestTimeZones.map((timeZone) => ({
  timeZone,
  value: unixEpochInstant.toZonedDateTimeISO(timeZone).toString(),
  unixMilliseconds: Number(unixEpochInstant.epochMilliseconds),
  unixSeconds: Math.floor(Number(unixEpochInstant.epochMilliseconds) / 1000),
  utc: unixEpochInstant.toString(),
}));

/**
 * Local noon in each battle-test timeZone.
 * Helpful for date-oriented tests that should avoid midnight edge cases.
 *
 * Example rows:
 * - UTC -> 2024-02-29T12:00:00+00:00[UTC]
 * - America/New_York -> 2024-02-29T12:00:00-05:00[America/New_York]
 * - Europe/Helsinki -> 2024-02-29T12:00:00+02:00[Europe/Helsinki]
 * - Pacific/Apia -> 2024-02-29T12:00:00+13:00[Pacific/Apia]
 * - Pacific/Niue -> 2024-02-29T12:00:00-11:00[Pacific/Niue]
 */
export const localNoonBattleCases = battleTestTimeZones.map((timeZone) => ({
  timeZone,
  value: Temporal.ZonedDateTime.from({
    year: 2024,
    month: 2,
    day: 29,
    hour: 12,
    minute: 0,
    second: 0,
    timeZone,
  }).toString(),
}));

/**
 * Local start/end range fixture per timeZone.
 * Used by range mappers that iterate inclusive calendar dates.
 *
 * Example rows:
 * - UTC -> start 2024-02-29T10:00:00+00:00[UTC], end 2024-03-02T10:00:00+00:00[UTC]
 * - America/New_York -> start 2024-02-29T10:00:00-05:00[America/New_York], end 2024-03-02T10:00:00-05:00[America/New_York]
 * - Europe/Helsinki -> start 2024-02-29T10:00:00+02:00[Europe/Helsinki], end 2024-03-02T10:00:00+02:00[Europe/Helsinki]
 * - Pacific/Apia -> start 2024-02-29T10:00:00+13:00[Pacific/Apia], end 2024-03-02T10:00:00+13:00[Pacific/Apia]
 * - Pacific/Niue -> start 2024-02-29T10:00:00-11:00[Pacific/Niue], end 2024-03-02T10:00:00-11:00[Pacific/Niue]
 */
export const localRangeBattleCases = battleTestTimeZones.map((timeZone) => ({
  timeZone,
  start: Temporal.ZonedDateTime.from({
    year: 2024,
    month: 2,
    day: 29,
    hour: 10,
    minute: 0,
    second: 0,
    timeZone,
  }).toString(),
  end: Temporal.ZonedDateTime.from({
    year: 2024,
    month: 3,
    day: 2,
    hour: 10,
    minute: 0,
    second: 0,
    timeZone,
  }).toString(),
  expected: ["2024-02-29", "2024-03-01", "2024-03-02"],
}));

// Stable fake "now" instant used by now/today related tests.
// Equivalent to Unix time 1709164800000, which is 2024-02-29T00:00:00Z.
export const fixedNowInstant = "2024-02-29T00:00:00.000Z";

// Test for leap year handling in timeZone conversions. 2024-02-29T00:00:00Z is 1709164800000 in unix milliseconds.
export const battleTestLeapYearUnix = 1709164800000;
export const battleTestLeapYearUnixSeconds = 1709164800;
export const battleTestLeapYearUtc = "2024-02-29T00:00:00Z";

// Unix time for 2024-02-29T00:00:00Z
export const unixFixture = {
  seconds: "1709164800",
  milliseconds: "1709164800000",
  invalid: ["", "not-a-timestamp", "171068584", "17092170450", "-1"],
} as const;

export const fixedSystemTimezone = "Europe/Helsinki";

export function mockSystemTimeZone(
  timeZone: string = fixedSystemTimezone,
): () => void {
  const defaultOptions = Intl.DateTimeFormat().resolvedOptions();
  const resolvedOptionsSpy = vi
    .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
    .mockReturnValue({
      ...defaultOptions,
      timeZone,
    });

  return () => {
    resolvedOptionsSpy.mockRestore();
  };
}
