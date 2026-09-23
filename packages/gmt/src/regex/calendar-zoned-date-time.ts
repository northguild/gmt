/**
 * RegExp matching a calendar-annotated ZonedDateTime string in the RFC 9557 form Temporal writes
 * and reads — the zoned sibling of `calendarDate` (regex/calendar-date.ts):
 *
 *   <date>T<time><offset>[<timeZone>][u-ca=<id>]
 *   2024-02-24T14:30:00-05:00[America/New_York][u-ca=hebrew]
 *
 * This is exactly `Temporal.ZonedDateTime#toString()` for a non-ISO calendar. The digits are ISO
 * and the calendar annotation follows the time zone annotation, in RFC 9557 §4.1 order. The date,
 * time and offset are ISO 8601 extended format with an upper-case `Z`. The date
 * half and the annotation are the same groups as `calendarDate`'s. The offset is optional; the
 * time zone annotation may carry RFC 9557's critical flag (`[!America/New_York]`), and so may the
 * calendar annotation.
 *
 * A match proves shape only: `internal/calendarZonedString.ts` hands the string to
 * `Temporal.ZonedDateTime.from` (zone, offset, DST) and the calendar id to Temporal's
 * `CanonicalizeCalendar`. This is the written form. GMT's calendar functions read more
 * (`isValidCalendarZonedDateTime`): every date-time `isValidZonedDateTime` reads (the functions
 * take the same strings as the non-calendar zoned functions, then the calendar annotation), and
 * the rest of Temporal's annotation grammar, such as an elective `[foo=bar]`, which Temporal
 * ignores.
 *
 * Capture groups: 1 year, 2 month, 3 day, 4 time, 5 offset (optional), 6 time zone annotation
 * (with its critical flag, if any), 7 calendar critical flag (`"!"` or undefined), 8 calendar id.
 *
 * @example calendarZonedDateTime.test("2024-02-24T14:30:00-05:00[America/New_York][u-ca=hebrew]") // true
 * @example calendarZonedDateTime.test("2024-02-24T14:30:00-05:00[u-ca=hebrew][America/New_York]") // false (calendar before zone)
 * @example calendarZonedDateTime.test("2024-03-15T14:30:00Z[UTC]") // false (no calendar annotation)
 */
export const calendarZonedDateTime: RegExp =
  /^(\d{4}|\+\d{6}|-(?!0{6})\d{6})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T(\d{2}:\d{2}(?::\d{2}(?:[.,]\d{1,9})?)?)((?:[+-]\d{2}:\d{2}(?::\d{2}(?:[.,]\d{1,9})?)?)|Z)?\[(!?[^[\]=!]+)\]\[(!)?u-ca=([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)\]$/;
