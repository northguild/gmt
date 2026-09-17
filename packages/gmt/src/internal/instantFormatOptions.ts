// Option resolution for formatting an exact time (a ZonedDateTime, or an
// Instant in a given zone) through the runtime's `Intl.DateTimeFormat`. The
// rules are the Temporal proposal's ECMA-402 amendments: CreateDateTimeFormat
// and GetDateTimeFormat with required ~any~ and inherit ~all~, so every caller
// field, including `era` and `timeZoneName`, is passed on unchanged.

import type { Temporal } from "@js-temporal/polyfill";
import { plainDateTimeFormatOptions } from "./plainFormatOptions";

type Options = Intl.DateTimeFormatOptions;

// GetDateTimeFormat requiredOptions for ~any~. `era` and `timeZoneName` are
// deliberately absent: neither suppresses the defaults.
const REQUIRED_FIELDS = [
  "weekday",
  "year",
  "month",
  "day",
  "dayPeriod",
  "hour",
  "minute",
  "second",
  "fractionalSecondDigits",
] as const;

const DEFAULT_FIELDS = {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
} as const;

/**
 * Resolve caller options into runtime `Intl.DateTimeFormat` options that
 * format an exact time in `timeZone`.
 *
 * - Returns `null` when the caller passed a `timeZone` option: the value is
 *   formatted in its own zone, and `Temporal.ZonedDateTime#toLocaleString`
 *   throws a TypeError for one (CreateDateTimeFormat with
 *   toLocaleStringTimeZone).
 * - With no date or time field and no `dateStyle`/`timeStyle`, year, month,
 *   day, hour, minute and second default to `"numeric"`. With `defaults`
 *   `"zoned-date-time"` (ZonedDateTime#toLocaleString) `timeZoneName` also
 *   defaults to `"short"`; with `"all"` (an Instant) it does not.
 *
 * @param options caller's `Intl.DateTimeFormatOptions`
 * @param timeZone the zone the value is formatted in
 * @param defaults GetDateTimeFormat defaults: `"zoned-date-time"` or `"all"`
 * @returns runtime options in `timeZone`, or `null` for a `timeZone` option
 */
export function instantFormatOptions(
  options: Options,
  timeZone: string,
  defaults: "zoned-date-time" | "all",
): Options | null {
  if (options.timeZone !== undefined) return null;
  const needDefaults =
    options.dateStyle === undefined &&
    options.timeStyle === undefined &&
    REQUIRED_FIELDS.every((field) => options[field] === undefined);
  if (!needDefaults) return { ...options, timeZone };
  // Defaults spread after the caller's options: needDefaults guarantees every
  // default field is undefined there, even when present as a key.
  return {
    ...options,
    ...DEFAULT_FIELDS,
    ...(defaults === "zoned-date-time"
      ? { timeZoneName: options.timeZoneName ?? "short" }
      : {}),
    timeZone,
  };
}

/**
 * Format an exact time as text, either as its wall clock (a PlainDateTime) or
 * as a ZonedDateTime with its zone, through the runtime's
 * `Intl.DateTimeFormat`. Shared by `formatUtc` and `formatUnix`.
 *
 * - The wall-clock path uses {@link plainDateTimeFormatOptions}
 *   (GetDateTimeFormat ~any~, ~all~, ~relevant~): `timeZoneName` is not
 *   inherited.
 * - The zoned path uses {@link instantFormatOptions} with
 *   `"zoned-date-time"` defaults.
 * - `options` must not carry a `timeZone`; the zone comes from
 *   `zonedDateTime`. Constructing with `options` first surfaces the TypeError
 *   or RangeError Intl.DateTimeFormat raises for invalid ones.
 *
 * @param zonedDateTime the value in the zone it is rendered in
 * @param locale BCP 47 locale, or `undefined` for the runtime default
 * @param options caller's `Intl.DateTimeFormatOptions` without `timeZone`
 * @param includeTimeZoneName `true` for the zoned path
 * @returns the formatted text, not yet normalised
 */
export function formatWallClockOrZoned(
  zonedDateTime: Temporal.ZonedDateTime,
  locale: string | undefined,
  options: Options,
  includeTimeZoneName: boolean,
): string {
  new Intl.DateTimeFormat(locale, options);
  if (includeTimeZoneName) {
    const resolved = instantFormatOptions(
      options,
      zonedDateTime.timeZoneId,
      "zoned-date-time",
    );
    return resolved === null
      ? ""
      : new Intl.DateTimeFormat(locale, resolved).format(
          zonedDateTime.epochMilliseconds,
        );
  }
  const wallClockMilliseconds = zonedDateTime
    .toPlainDateTime()
    .toZonedDateTime("UTC").epochMilliseconds;
  return new Intl.DateTimeFormat(
    locale,
    plainDateTimeFormatOptions(options),
  ).format(wallClockMilliseconds);
}
