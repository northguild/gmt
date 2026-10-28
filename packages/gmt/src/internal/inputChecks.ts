import { Temporal } from "./temporal";
import { isoStringBody } from "./isoStringBody";
import { isRememberedZone, rememberZone } from "./validatedZones";
import { hasSecond60 } from "../plain/validate/hasSecond60";
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

/** The cores of the `isValid*` functions, so a public function never calls another. */

/**
 * The check behind `isValidTimeZone`: an IANA name or a UTC offset to the minute. A pass is
 * remembered, so a repeat builds nothing.
 *
 * @param timeZone the candidate
 * @returns whether it names a zone
 *
 * @example isZoneId("Europe/London") // true
 * @example isZoneId("Not/AZone") // false
 */
export function isZoneId(timeZone: unknown): boolean {
  if (typeof timeZone === "string" && isRememberedZone(timeZone)) {
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
      timeZone: timeZone as string,
    });
    if (!timeZoneLike.test(timeZone as string)) {
      return false;
    }
    // Only a pass is stored, so hostile strings cannot grow the set.
    if (typeof timeZone !== "string") {
      return true;
    }
    rememberZone(timeZone);
    return true;
  } catch {
    return false;
  }
}

/**
 * The check behind `isValidTime`: a plain ISO 8601 time of day.
 *
 * @param value the candidate string
 * @returns whether Temporal reads it as a `PlainTime` and it has the strict shape
 *
 * @example isTimeString("17:00") // true
 * @example isTimeString("25:00") // false
 */
export function isTimeString(value: string): boolean {
  const body = isoStringBody(value);
  if (hasSecond60(body) || !plainTime.test(body)) {
    return false;
  }
  try {
    Temporal.PlainTime.from(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * The check behind `isValidDate`: a plain ISO 8601 calendar date.
 *
 * @param value the candidate string
 * @returns whether Temporal reads it as an ISO calendar `PlainDate` and it has the strict shape
 *
 * @example isDateString("2024-02-29") // true
 * @example isDateString("2024-02-30") // false
 */
export function isDateString(value: string): boolean {
  const body = isoStringBody(value);
  if (hasSecond60(body) || !plainDate.test(body)) {
    return false;
  }
  try {
    return Temporal.PlainDate.from(value).calendarId === "iso8601";
  } catch {
    return false;
  }
}

/**
 * The check behind `isValidDateTime`: the ISO calendar `PlainDateTime` a plain ISO 8601
 * date-time string names, or `null`.
 *
 * @param value the candidate string
 * @returns the `PlainDateTime` Temporal reads when it has the strict shape and the ISO calendar, else `null`
 *
 * @example plainDateTimeOf("2024-02-29T12:00")?.day // 29
 * @example plainDateTimeOf("2024-02-29T23:59:60") // null
 */
export function plainDateTimeOf(value: string): Temporal.PlainDateTime | null {
  const body = isoStringBody(value);
  if (hasSecond60(body) || !plainDateTime.test(body)) {
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
 * The check behind `isValidDuration`: an ISO 8601 duration string.
 *
 * @param value the candidate
 * @returns whether it is a string Temporal reads as a `Duration`
 *
 * @example isDurationString("P1DT2H") // true
 * @example isDurationString("2 days") // false
 */
export function isDurationString(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  try {
    Temporal.Duration.from(value);
    return true;
  } catch {
    return false;
  }
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
