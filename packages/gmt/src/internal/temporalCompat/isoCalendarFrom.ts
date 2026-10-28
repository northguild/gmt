import { Temporal } from "../temporal";
import { isIsoCalendarCaseCompatNeeded } from "./capabilities";

/** A `u-ca` annotation, critical or not: the key, then the value up to the closing bracket. */
const CALENDAR_ANNOTATION = /\[(!?u-ca=)([^\]]*)\]/g;

/** ASCII upper case to lower case, one character at a time: `toLowerCase()` also folds non-ASCII letters. */
function asciiLowerCase(text: string): string {
  return text.replace(/[A-Z]/g, (letter) =>
    String.fromCharCode(letter.charCodeAt(0) + 32),
  );
}

/** Lower-cases the value of every `[u-ca=…]` and `[!u-ca=…]` annotation, in ASCII; the rest is unchanged. */
function lowerCalendarAnnotations(value: string): string {
  return value.replace(
    CALENDAR_ANNOTATION,
    (_match, key: string, calendar: string) =>
      `[${key}${asciiLowerCase(calendar)}]`,
  );
}

/**
 * `Temporal.PlainMonthDay.from(value)`, throwing as it does, but reading an upper-case `iso8601`
 * calendar annotation as the specification does (defect D20).
 *
 * Temporal ParseISODateTime, for the goal TemporalMonthDayString with no DateYear, throws only
 * "If calendar is not empty and the ASCII-lowercase of calendar is not "iso8601"". Polyfill 0.5.1
 * compares the value as written, so `--12-25[u-ca=ISO8601]` throws there. While probe D20 fails,
 * the value of every `[u-ca=…]` and `[!u-ca=…]` annotation is lower-cased in ASCII first, which
 * keeps the first-annotation-wins and critical-flag rules. Every other part of the string is
 * passed unchanged, so every other error is Temporal's own. Where the probe passes the polyfill
 * reads the value itself.
 *
 * @param value an ISO 8601 month-day string
 * @returns the `PlainMonthDay` Temporal reads
 * @throws RangeError when Temporal refuses the string
 *
 * @example monthDayFrom("--12-25[u-ca=ISO8601]").toString() // "12-25"
 * @example monthDayFrom("--12-25[u-ca=gregory]") // throws RangeError
 */
export function monthDayFrom(value: string): Temporal.PlainMonthDay {
  if (!isIsoCalendarCaseCompatNeeded()) {
    return Temporal.PlainMonthDay.from(value);
  }
  return Temporal.PlainMonthDay.from(lowerCalendarAnnotations(value));
}

/**
 * `Temporal.PlainYearMonth.from(value)`, throwing as it does, but reading an upper-case `iso8601`
 * calendar annotation as the specification does (defect D20, the year-month twin).
 *
 * Temporal ParseISODateTime, for the goal TemporalYearMonthString with no DateDay, throws only
 * "If calendar is not empty and the ASCII-lowercase of calendar is not "iso8601"". Polyfill 0.5.1
 * compares the value as written, so `2026-10[u-ca=ISO8601]` throws there. The rewrite is the one
 * `monthDayFrom` makes, and the same probe gates it.
 *
 * @param value an ISO 8601 year-month string
 * @returns the `PlainYearMonth` Temporal reads
 * @throws RangeError when Temporal refuses the string
 *
 * @example yearMonthFrom("2026-10[u-ca=ISO8601]").toString() // "2026-10"
 * @example yearMonthFrom("2026-10[u-ca=gregory]") // throws RangeError
 */
export function yearMonthFrom(value: string): Temporal.PlainYearMonth {
  if (!isIsoCalendarCaseCompatNeeded()) {
    return Temporal.PlainYearMonth.from(value);
  }
  return Temporal.PlainYearMonth.from(lowerCalendarAnnotations(value));
}
