import { Temporal } from "./temporal";
import { isoStringBody } from "./isoStringBody";
import { isRememberedZone, rememberZone } from "./validatedZones";
import { leapSecond } from "../regex/leap-second";
import {
  plainDate,
  plainDateTime,
  plainMonthDay,
  plainTime,
  plainYearMonth,
  timeZoneLike,
} from "../regex";
import { monthDayFrom, yearMonthFrom } from "./temporalCompat";
import type { RollConvention } from "../types";
import { nanosecondDecimal } from "../regex/nanoseconds";
import {
  isValidEpochNanoseconds,
  MAX_EPOCH_NANOSECOND_DIGITS,
} from "./epochNanoseconds";

/** The cores of the `isValid*` functions, so a public function never calls another. */

/**
 * The check behind `isValidTimeZone`: an IANA name or a UTC offset to the minute. A pass is
 * remembered, so a repeat builds nothing.
 *
 * @param timeZone the candidate; a value that is not a string is not a zone
 * @returns whether it names a zone
 *
 * @example isZoneId("Europe/London") // true
 * @example isZoneId("Not/AZone") // false
 */
export function isZoneId(timeZone: unknown): boolean {
  // Temporal also reads a ZonedDateTime as a zone identifier; a value that is not a string is
  // not an identifier.
  if (typeof timeZone !== "string") {
    return false;
  }
  if (isRememberedZone(timeZone)) {
    return true;
  }
  try {
    // The fixed 2020 bag is never near the range edge, so `zonedDateTimeFrom`'s only
    // workaround does not apply; calling Temporal directly keeps `zonedWallClock` out of the
    // business-day entries.
    Temporal.ZonedDateTime.from({
      year: 2020,
      month: 2,
      day: 28,
      hour: 0,
      minute: 0,
      second: 0,
      timeZone,
    });
    if (!timeZoneLike.test(timeZone)) {
      return false;
    }
    // Only a pass is stored, so hostile strings cannot grow the set.
    rememberZone(timeZone);
    return true;
  } catch {
    return false;
  }
}

/**
 * The check behind `hasSecond60`: whether the string has a second-60 field, the spelling
 * Temporal would silently clamp to `:59`.
 *
 * @param value the candidate; a value that is not a string has no second field
 * @returns whether the string has a second-60 field
 *
 * @example hasSecond60Field("2016-12-31T23:59:60Z") // true
 * @example hasSecond60Field("2016-12-31T23:59:59Z") // false
 */
export function hasSecond60Field(value: unknown): boolean {
  return typeof value === "string" && leapSecond.test(value);
}

/**
 * The check behind `isValidTime`: the `PlainTime` a plain ISO 8601 time-of-day string names, or
 * `null`.
 *
 * @param value the candidate; a value that is not a string is not a time
 * @returns the `PlainTime` Temporal reads when it has the strict shape, else `null`
 *
 * @example plainTimeOf("17:00")?.hour // 17
 * @example plainTimeOf("25:00") // null
 * @example plainTimeOf(null) // null
 */
export function plainTimeOf(value: unknown): Temporal.PlainTime | null {
  if (typeof value !== "string") {
    return null;
  }
  const body = isoStringBody(value);
  if (hasSecond60Field(body) || !plainTime.test(body)) {
    return null;
  }
  try {
    return Temporal.PlainTime.from(value);
  } catch {
    return null;
  }
}

/**
 * Whether `value` is a plain ISO 8601 time of day.
 *
 * @param value the candidate string
 * @returns whether `plainTimeOf` reads it
 *
 * @example isTimeString("17:00") // true
 * @example isTimeString("25:00") // false
 */
export function isTimeString(value: string): boolean {
  return plainTimeOf(value) !== null;
}

/**
 * The check behind `isValidDate`: the ISO calendar `PlainDate` a plain ISO 8601 date string
 * names, or `null`.
 *
 * @param value the candidate; a value that is not a string is not a date
 * @returns the `PlainDate` Temporal reads when it has the strict shape and the ISO calendar, else `null`
 *
 * @example plainDateOf("2024-02-29")?.day // 29
 * @example plainDateOf("2024-02-30") // null
 * @example plainDateOf(null) // null
 */
export function plainDateOf(value: unknown): Temporal.PlainDate | null {
  if (typeof value !== "string") {
    return null;
  }
  const body = isoStringBody(value);
  if (hasSecond60Field(body) || !plainDate.test(body)) {
    return null;
  }
  try {
    const date = Temporal.PlainDate.from(value);
    return date.calendarId === "iso8601" ? date : null;
  } catch {
    return null;
  }
}

/**
 * Whether `value` is a plain ISO 8601 calendar date.
 *
 * @param value the candidate string
 * @returns whether `plainDateOf` reads it
 *
 * @example isDateString("2024-02-29") // true
 * @example isDateString("2024-02-30") // false
 */
export function isDateString(value: string): boolean {
  return plainDateOf(value) !== null;
}

/**
 * The check behind `isValidDateTime`: the ISO calendar `PlainDateTime` a plain ISO 8601
 * date-time string names, or `null`.
 *
 * @param value the candidate; a value that is not a string is not a date-time
 * @returns the `PlainDateTime` Temporal reads when it has the strict shape and the ISO calendar, else `null`
 *
 * @example plainDateTimeOf("2024-02-29T12:00")?.day // 29
 * @example plainDateTimeOf("2024-02-29T23:59:60") // null
 * @example plainDateTimeOf(null) // null
 */
export function plainDateTimeOf(value: unknown): Temporal.PlainDateTime | null {
  if (typeof value !== "string") {
    return null;
  }
  const body = isoStringBody(value);
  if (hasSecond60Field(body) || !plainDateTime.test(body)) {
    return null;
  }
  try {
    const dateTime = Temporal.PlainDateTime.from(value);
    return dateTime.calendarId === "iso8601" ? dateTime : null;
  } catch {
    return null;
  }
}

/**
 * The check behind `isValidIsoDateLike`: whether `value` is an ISO calendar `PlainDate` or
 * `PlainDateTime` string.
 *
 * @param value the candidate; a value that is not a string is not date-like
 * @returns whether it is a strict ISO date or date-time in the ISO calendar
 *
 * @example isoDateLikeOf("2024-02-29") // true
 * @example isoDateLikeOf("2024-02-29T12:34:56") // true
 * @example isoDateLikeOf("2024-02-30") // false
 */
export function isoDateLikeOf(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  const body = isoStringBody(value);
  if (hasSecond60Field(body)) {
    return false;
  }
  if (plainDate.test(body)) {
    return plainDateOf(value) !== null;
  }
  if (plainDateTime.test(body)) {
    return plainDateTimeOf(value) !== null;
  }
  return false;
}

/**
 * The check behind `isValidMonthDay`: the ISO calendar `PlainMonthDay` a month-day string names,
 * or `null`.
 *
 * The part before the first annotation must match `plainMonthDay`, which refuses the basic form,
 * a year, a time, `Z`, an offset and a day no year has (`--02-30`) before Temporal is asked.
 * Temporal then reads the annotations (`monthDayFrom`, defect D20) and the calendar must be ISO.
 *
 * @param value the candidate
 * @returns the `PlainMonthDay` when the string is a month-day in the ISO calendar, else `null`
 *
 * @example plainMonthDayOf("--02-29")?.day // 29
 * @example plainMonthDayOf("--02-30") // null
 * @example plainMonthDayOf(null) // null
 */
export function plainMonthDayOf(value: unknown): Temporal.PlainMonthDay | null {
  if (typeof value !== "string" || !plainMonthDay.test(isoStringBody(value))) {
    return null;
  }
  try {
    const monthDay = monthDayFrom(value);
    return monthDay.calendarId === "iso8601" ? monthDay : null;
  } catch {
    return null;
  }
}

/**
 * The check behind `isValidYearMonth`: the ISO calendar `PlainYearMonth` a year-month string
 * names, or `null`.
 *
 * The part before the first annotation must match `plainYearMonth`, which refuses the basic form,
 * a date, a time, `Z` and an offset before Temporal is asked. Temporal then enforces the range
 * (`-271821-04` to `+275760-09`) and reads the annotations (`yearMonthFrom`, defect D20), and the
 * calendar must be ISO.
 *
 * @param value the candidate
 * @returns the `PlainYearMonth` when the string is a year-month in the ISO calendar, else `null`
 *
 * @example plainYearMonthOf("2026-10")?.month // 10
 * @example plainYearMonthOf("2026-10-01") // null
 * @example plainYearMonthOf(null) // null
 */
export function plainYearMonthOf(
  value: unknown,
): Temporal.PlainYearMonth | null {
  if (typeof value !== "string" || !plainYearMonth.test(isoStringBody(value))) {
    return null;
  }
  try {
    const yearMonth = yearMonthFrom(value);
    return yearMonth.calendarId === "iso8601" ? yearMonth : null;
  } catch {
    return null;
  }
}

/**
 * The check behind `isValidDuration`: the `Duration` an ISO 8601 duration string names, or `null`.
 *
 * @param value the candidate; a value that is not a string is not a duration
 * @returns the `Duration` Temporal reads, else `null`
 *
 * @example durationOf("P1DT2H")?.hours // 2
 * @example durationOf("2 days") // null
 * @example durationOf(null) // null
 */
export function durationOf(value: unknown): Temporal.Duration | null {
  if (typeof value !== "string") {
    return null;
  }
  try {
    return Temporal.Duration.from(value);
  } catch {
    return null;
  }
}

/**
 * Whether `value` is an ISO 8601 duration string.
 *
 * @param value the candidate
 * @returns whether `durationOf` reads it
 *
 * @example isDurationString("P1DT2H") // true
 * @example isDurationString("2 days") // false
 */
export function isDurationString(value: unknown): boolean {
  return durationOf(value) !== null;
}

const ROLL_CONVENTIONS: readonly RollConvention[] = [
  "following",
  "modifiedFollowing",
  "preceding",
  "modifiedPreceding",
  "endOfMonth",
  "none",
];

/**
 * The check behind `isValidRollConvention`: membership in the roll set.
 *
 * @param convention the candidate
 * @returns whether it is one of the six conventions
 *
 * @example isRollConventionName("following") // true
 * @example isRollConventionName("nearest") // false
 */
export function isRollConventionName(
  convention: unknown,
): convention is RollConvention {
  return (
    typeof convention === "string" &&
    ROLL_CONVENTIONS.includes(convention as RollConvention)
  );
}

/**
 * The check behind `isValidNanoPattern`: a decimal integer string in the epoch-nanosecond range.
 *
 * @param value the candidate; a value that is not a string is not a nanosecond pattern
 * @returns whether it is a nanosecond pattern in range
 *
 * @example isNanoPattern("1700000000000000000") // true
 * @example isNanoPattern("1.5") // false
 */
export function isNanoPattern(value: unknown): boolean {
  if (typeof value !== "string" || !nanosecondDecimal.test(value)) {
    return false;
  }

  // Out of range by inspection once it is longer than MAX_EPOCH_NANOSECONDS, and stopping
  // here keeps BigInt off an arbitrarily long payload string.
  const digits = value.startsWith("-") ? value.length - 1 : value.length;

  if (digits > MAX_EPOCH_NANOSECOND_DIGITS) {
    return false;
  }

  return isValidEpochNanoseconds(BigInt(value));
}
