import { Temporal } from "./temporal";
import {
  canonicalCalendarSystem,
  computationCalendarId,
} from "./calendarSystemIds";
import { hasCalendarDateShape } from "./isoStringBody";

/**
 * Second `60` in the time of day, before any `[`: `T`, `t` or space separator, extended or basic
 * digits. Temporal's ParseISODateTime clamps it to `:59`; GMT's Plain date-time inputs reject it
 * (`isValidDateTime`, a duration `relativeTo`). Unlike `regex/leap-second.ts`, no designator is
 * required, because a Plain string has none.
 */
export const temporalStringLeapSecond =
  /^[^[]*?[Tt ]\d{2}:?\d{2}:?60(?:[.,]\d+)?(?:[-+Zz[]|$)/;

/**
 * Parse a GMT calendar date string into a Temporal.PlainDate, exactly as `Temporal.PlainDate.from`
 * reads it, restricted to GMT's written shape and GMT's calendars. Throws on invalid input — callers
 * wrap this in try-catch per GMT's sentinel contract.
 *
 * - The whole string must be GMT's strict extended date (`plainDate`) or date-time
 *   (`plainDateTime`), as `isValidDate` and `isValidDateTime` require, optionally followed by one
 *   calendar annotation (`[u-ca=hebrew]`, or critical `[!u-ca=hebrew]`) and nothing else. Basic
 *   format (`20241003`), a space or lower-case `t` separator and a UTC offset are rejected,
 *   although `Temporal.PlainDate.from` reads them, and so is every other annotation: a time zone
 *   (`[Europe/Helsinki]`, `[!Not/AZone]`, `[+02:00]`), an elective `[foo=bar]` and a second
 *   `u-ca`. Only then does Temporal read the string.
 * - An ISO date with a calendar annotation (`"2024-10-03[u-ca=hebrew]"`, which is what
 *   `Temporal.PlainDate#toString()` writes). The digits are always the ISO date; the annotation
 *   names the calendar (RFC 9557 §3.3).
 * - A date-time is read as its date, as `Temporal.PlainDate.from` reads it
 *   (`"2024-10-03T14:30[u-ca=hebrew]"` is 2024-10-03 in Hebrew): the time is dropped. A leap
 *   second (second `60`) is rejected, as every GMT Plain date-time input rejects it.
 * - `Temporal.PlainDate.from` canonicalizes the calendar id (`HEBREW` → `hebrew`, `islamicc` →
 *   `islamic-civil`, `ethiopic-amete-alem` → `ethioaa`).
 * - The calendar must be a `CalendarSystem`. Temporal also knows `chinese`, `dangi`, `islamic` and
 *   `islamic-rgsa`, which GMT does not support.
 * - The result computes in `computationCalendarId(calendar)`: `"ethiopic"` and `"coptic"` are read
 *   in `"ethioaa"`, so callers that write a string back take the calendar from
 *   `calendarSystemOfDateValue(value)`, not from `date.calendarId`.
 *
 * @param value an extended ISO date or date-time, optionally with one calendar annotation
 * @returns the Temporal.PlainDate, in the computation calendar
 */
export function parseCalendarDateValue(value: string): Temporal.PlainDate {
  // Temporal.PlainDate.from also takes objects and property bags; GMT reads strings only.
  if (typeof value !== "string") {
    throw new TypeError("A GMT calendar date must be a string");
  }
  if (temporalStringLeapSecond.test(value)) {
    throw new RangeError(`Leap seconds are not supported: ${value}`);
  }
  if (!hasCalendarDateShape(value)) {
    throw new RangeError(
      `Not an extended ISO 8601 date or date-time with at most a calendar annotation: ${value}`,
    );
  }
  const date = Temporal.PlainDate.from(value);
  const calendar = canonicalCalendarSystem(date.calendarId);
  if (!calendar) {
    throw new RangeError(`Unsupported calendar: ${date.calendarId}`);
  }
  return date.withCalendar(computationCalendarId(calendar));
}

/**
 * The check behind `isValidCalendarDate`: the `PlainDate` `parseCalendarDateValue` reads, or
 * `null` where it throws.
 *
 * @param value the candidate; a value that is not a non-empty string is not a calendar date
 * @returns the `PlainDate` in the computation calendar, else `null`
 *
 * @example calendarDateOf("2024-10-03[u-ca=hebrew]")?.calendarId // "hebrew"
 * @example calendarDateOf("2024-02-30") // null
 * @example calendarDateOf(null) // null
 */
export function calendarDateOf(value: unknown): Temporal.PlainDate | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  try {
    return parseCalendarDateValue(value);
  } catch {
    return null;
  }
}
