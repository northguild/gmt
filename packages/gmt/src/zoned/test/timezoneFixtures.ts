import { Temporal } from "@js-temporal/polyfill";
import { MustTestDstTimezones } from "../../test/timezoneMatrix";

// Core timezone matrix used by zoned tests.
// Includes DST, UTC-like, negative offset, half-hour, and quarter-hour zones.
export const battleTestTimeZones = Object.values(MustTestDstTimezones);

// Alias-friendly matrix used by timezone validators.
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
 * Same instant represented in every battle-test timezone.
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
 * Unix epoch represented in every battle-test timezone.
 * Use this to catch historical timezone-offset differences.
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
 * Local noon in each battle-test timezone.
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
 * Local start/end range fixture per timezone.
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
export const fixedNowInstant = "2024-02-29T00:00:00.000Z";

// Test for leap year handling in timezone conversions. 2024-02-29T00:00:00Z is 1709164800000 in unix milliseconds.
export const battleTestLeapYearUnix = 1709164800000;
