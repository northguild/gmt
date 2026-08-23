import { parseCalendarDateValue } from "../../internal";

/**
 * Return true if `value` is a valid GMT PlainDate string: a plain ISO date
 * ("2024-10-03") or a calendar-annotated date with calendar-native fields
 * ("5785-01-01[u-ca=hebrew]"), as produced by `convertDateToCalendar`.
 *
 * - Delegates all field-range and calendar-identifier checking to
 *   `Temporal.PlainDate.from` (via `parseCalendarDateValue`).
 *
 * @param value ISO PlainDate string, optionally calendar-annotated
 * @returns boolean indicating validity
 *
 * @example isValidCalendarDate("2024-10-03") // true
 * @example isValidCalendarDate("5785-01-01[u-ca=hebrew]") // true
 * @example isValidCalendarDate("2024-10-03[u-ca=martian]") // false (unknown calendar identifier)
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
