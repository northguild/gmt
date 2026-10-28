import { plainDateTimeOf } from "../../internal/inputChecks";
import { monthDayString } from "../../internal/monthDay";

/**
 * Return the month-day (`--MM-DD`) of an ISO 8601 date-time string.
 *
 * - The year and the time are dropped, so the time never moves the day.
 * - A `Z` or an offset gives `""`; a time zone annotation with no offset is ignored, as
 *   `isValidDateTime` reads it.
 * - Only the ISO calendar is read.
 * - Returns "" for invalid input.
 *
 * @param value ISO date-time string
 * @returns The canonical `--MM-DD` string, or "" on invalid input
 *
 * @example parseMonthDayFromDateTime("2024-12-25T10:00:00") // "--12-25"
 * @example parseMonthDayFromDateTime("2024-02-29T23:59:59.999999999") // "--02-29"
 * @example parseMonthDayFromDateTime("2024-12-25") // ""
 * @example parseMonthDayFromDateTime("2024-12-25T10:00:00Z") // ""
 * @example parseMonthDayFromDateTime("2024-12-25T10:00:00[Europe/Paris]") // "--12-25"
 */
export function parseMonthDayFromDateTime(value: string): string {
  const dateTime = plainDateTimeOf(value);
  if (dateTime === null) return "";

  try {
    return monthDayString(dateTime.toPlainDate().toPlainMonthDay());
  } catch {
    return "";
  }
}
