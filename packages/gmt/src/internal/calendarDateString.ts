import { Temporal } from "@js-temporal/polyfill";
import { plainDate } from "../regex/date";
import { plainDateTime } from "../regex/date-time";
import {
  canonicalCalendarSystem,
  computationCalendarId,
} from "./calendarSystemIds";
import { isoStringBody } from "./isoStringBody";

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
 * - The part before the first `[` must be GMT's strict extended date (`plainDate`) or date-time
 *   (`plainDateTime`), as `isValidDate` and `isValidDateTime` require. Basic
 *   format (`20241003`), a space or lower-case `t` separator and a UTC offset are rejected, although
 *   `Temporal.PlainDate.from` reads them. Only then does Temporal read the annotations.
 * - An ISO date, optionally followed by RFC 9557 annotations (`"2024-10-03[u-ca=hebrew]"`, which is
 *   what `Temporal.PlainDate#toString()` writes). The digits are always the ISO date; the annotation
 *   names the calendar (RFC 9557 §3.3).
 * - A date-time is read as its date, as `Temporal.PlainDate.from` reads it
 *   (`"2024-10-03T14:30[u-ca=hebrew]"` is 2024-10-03 in Hebrew): the time is dropped. A leap
 *   second (second `60`) is rejected, as every GMT Plain date-time input rejects it.
 * - The annotations follow Temporal's ISO grammar (`ParseISODateTime`): a time zone annotation
 *   and elective unknown annotations (`[foo=bar]`) are read and ignored, the first `u-ca`
 *   annotation names the calendar, and an unknown critical annotation (`[!foo=bar]`) or a second
 *   `u-ca` annotation when either one is critical is rejected. `Temporal.PlainDate.from` applies
 *   those rules and canonicalizes the id (`HEBREW` → `hebrew`, `islamicc` → `islamic-civil`,
 *   `ethiopic-amete-alem` → `ethioaa`).
 * - The calendar must be a `CalendarSystem`. Temporal also knows `chinese`, `dangi`, `islamic` and
 *   `islamic-rgsa`, which GMT does not support.
 * - The result computes in `computationCalendarId(calendar)`: `"ethiopic"` and `"coptic"` are read
 *   in `"ethioaa"`, so callers that write a string back take the calendar from
 *   `calendarSystemOfDateValue(value)`, not from `date.calendarId`.
 *
 * @param value an extended ISO date or date-time, optionally with RFC 9557 annotations
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
  const body = isoStringBody(value);
  if (!plainDate.test(body) && !plainDateTime.test(body)) {
    throw new RangeError(
      `Not an extended ISO 8601 date or date-time: ${value}`,
    );
  }
  const date = Temporal.PlainDate.from(value);
  const calendar = canonicalCalendarSystem(date.calendarId);
  if (!calendar) {
    throw new RangeError(`Unsupported calendar: ${date.calendarId}`);
  }
  return date.withCalendar(computationCalendarId(calendar));
}
