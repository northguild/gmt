import { plainDateTimeOf } from "../../internal/inputChecks";
import { yearMonthString } from "../../internal/yearMonth";

/**
 * Return the year-month (`YYYY-MM`) of an ISO 8601 date-time string.
 *
 * - The day and the time are dropped, so the time never moves the month.
 * - A `Z`, an offset or any annotation gives `""`, as `isValidDateTime` reads a plain
 *   date-time.
 * - Only the ISO calendar is read.
 * - Returns "" for invalid input.
 *
 * @param value ISO date-time string
 * @returns The canonical `YYYY-MM` string (`±YYYYYY-MM` outside 0000-9999), or "" on invalid input
 *
 * @example parseYearMonthFromDateTime("2026-10-01T10:00:00") // "2026-10"
 * @example parseYearMonthFromDateTime("2026-10-31T23:59:59.999999999") // "2026-10"
 * @example parseYearMonthFromDateTime("2026-10-01") // ""
 * @example parseYearMonthFromDateTime("2026-10-01T10:00:00Z") // ""
 * @example parseYearMonthFromDateTime("2026-10-01T10:00:00[Europe/Paris]") // ""
 */
export function parseYearMonthFromDateTime(value: string): string {
  const dateTime = plainDateTimeOf(value);
  if (dateTime === null) return "";

  try {
    return yearMonthString(dateTime.toPlainDate().toPlainYearMonth());
  } catch {
    return "";
  }
}
