import { Temporal } from "@js-temporal/polyfill";

export const battleTestTimeZones = [
  "Pacific/Niue",
  "Pacific/Apia",
  "UTC",
  "Etc/GMT",
  "Europe/Helsinki",
  "America/New_York",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Pacific/Chatham",
] as const;

export const validOnlyBattleTestTimeZones = [
  ...battleTestTimeZones,
  "Asia/Calcutta",
] as const;

const battleTestInstant = Temporal.Instant.from("2024-02-29T00:00:00Z");

export const sameInstantBattleCases = battleTestTimeZones.map((timeZone) => ({
  timeZone,
  value: battleTestInstant.toZonedDateTimeISO(timeZone).toString(),
  unixMilliseconds: Number(battleTestInstant.epochMilliseconds),
  unixSeconds: Math.floor(Number(battleTestInstant.epochMilliseconds) / 1000),
  utc: battleTestInstant.toString(),
}));

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

export const fixedNowInstant = "2024-02-29T00:00:00.000Z";
