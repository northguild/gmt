import { parseCalendarDateValue } from "../../internal";

/**
 * Return true if `value` is a valid GMT PlainDate string: a bare ISO date ("2024-10-03") or an
 * RFC 9557 calendar-annotated date ("2024-10-03[u-ca=hebrew]"), as `Temporal.PlainDate#toString()`
 * and `convertDateToCalendar` write it.
 *
 * - The digits are the ISO date whatever the calendar, so the ISO date must be valid and within
 *   Temporal's range (-271821-04-19 to +275760-09-13). The year is four digits or a sign and six.
 * - A `[u-ca=<id>]` annotation, optionally critical (`[!u-ca=hebrew]`). Temporal's
 *   `CanonicalizeCalendar` validates the id, folding case and aliases (`[u-ca=HEBREW]`,
 *   `[u-ca=ethiopic-amete-alem]`), and the calendar must be one GMT supports (`CalendarSystem`);
 *   `chinese`, `dangi`, `islamic` and `islamic-rgsa` return false.
 * - The annotations follow Temporal's ISO grammar, as `Temporal.PlainDate.from` reads them: a time
 *   zone annotation and elective unknown annotations (`[foo=bar]`) are ignored and the first
 *   `u-ca` annotation names the calendar; an unknown critical annotation (`[!foo=bar]`) or a
 *   second `u-ca` annotation when either is critical returns false.
 * - A date-time is valid and names its date, as `Temporal.PlainDate.from` reads it
 *   (`"2024-10-03T14:30[u-ca=hebrew]"` is 2024-10-03 in Hebrew): the time is dropped.
 * - The part before the first `[` must match GMT's strict extended shape, as `isValidDate` and
 *   `isValidDateTime` require: basic format (`20241003`), a space or lower-case `t` separator, a
 *   UTC offset or designator and a leap second (second `60`) return false, although
 *   `Temporal.PlainDate.from` reads all but the designator.
 * - Returns false for non-strings or empty strings.
 *
 * Compatibility: since 1.16.0 the string is RFC 9557, and a date-time is read as its date (earlier
 * releases returned false). Earlier releases accepted calendar-native
 * digits, `;era=` and the ids `gregorian`, `taiwan`, `islamic-tabular` and `ethiopic-amete-alem`;
 * a `;era=` string or a six-digit unsigned year now returns false, and any other such string is
 * read as the ISO date its digits spell.
 *
 * @param value ISO PlainDate string, optionally calendar-annotated
 * @returns boolean indicating validity
 *
 * @example isValidCalendarDate("2024-10-03") // true
 * @example isValidCalendarDate("2024-10-03[u-ca=hebrew]") // true
 * @example isValidCalendarDate("+275760-09-13[u-ca=roc]") // true
 * @example isValidCalendarDate("2024-10-03[!u-ca=japanese]") // true (critical flag)
 * @example isValidCalendarDate("2024-10-03[Asia/Tokyo][u-ca=hebrew]") // true (the time zone annotation is ignored)
 * @example isValidCalendarDate("2024-10-03T14:30:00[u-ca=hebrew]") // true (a date-time names its date)
 * @example isValidCalendarDate("2024-10-03T14:30:00Z[u-ca=hebrew]") // false (UTC designator on a Plain type)
 * @example isValidCalendarDate("20241003[u-ca=hebrew]") // false (basic format, as isValidDate)
 * @example isValidCalendarDate("2024-10-03T14:30+01:00[u-ca=hebrew]") // false (UTC offset, as isValidDateTime)
 * @example isValidCalendarDate("2024-10-03[!foo=bar][u-ca=hebrew]") // false (unknown critical annotation)
 * @example isValidCalendarDate("2024-10-03[u-ca=martian]") // false (unknown calendar identifier)
 * @example isValidCalendarDate("2024-10-03[u-ca=chinese]") // false (not supported by GMT)
 * @example isValidCalendarDate("0006-10-03[u-ca=japanese;era=reiwa]") // false (not RFC 9557)
 * @example isValidCalendarDate("invalid") // false
 */
export function isValidCalendarDate(value: string): boolean {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  try {
    parseCalendarDateValue(value);
    return true;
  } catch {
    return false;
  }
}
