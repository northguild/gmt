import {
  SWIFT_VALUE_DATE_FIRST_YEAR,
  SWIFT_VALUE_DATE_LAST_YEAR,
  writeSwiftDate,
} from "../../internal";
import { isDateString } from "../../internal/inputChecks";
import { Temporal } from "../../internal/temporal";

/**
 * Write an ISO 8601 date as a SWIFT MT value date, `YYMMDD`. The inverse of `parseSwiftDate`.
 *
 * - **What it writes.** The six-digit value date (`<DATE2>`, `6!n`) that SWIFT's rule covers:
 *   field 32A of MT 910, and fields 30 and 32A of category 1 and 2 messages other than the
 *   common group messages n92, n95 and n96. Two digits each of year, month and day.
 * - **`value`** is a date, as `isValidDate` accepts it, in the ISO calendar. A date-time, an
 *   instant or a non-ISO calendar returns `""`: a date-time names a calendar date only in a
 *   zone, so take the date in the zone you mean first.
 * - **The year must be 2001 to 2060**, the range SWIFT accepts for those value dates. Any other
 *   year returns `""`: written as two digits, it would read back as another year or be refused
 *   with error T50. So `parseSwiftDate(formatSwiftDate(d))` reads back as the same date, written
 *   `YYYY-MM-DD` (`d` itself when `d` is already written that way).
 * - **Sources.** SWIFT _Standards MT General Information_ (Standards MT November 2025), §6.3.1
 *   Dates and §6.3.6 Value Date Ordering:
 *   https://www2.swift.com/knowledgecentre/rest/v1/publications/usgi_20250718/2.0/usgi_20250718.pdf
 * - Returns `""` for a non-string argument.
 *
 * @param value An ISO 8601 calendar date (e.g. "2024-06-15")
 * @returns the `YYMMDD` string ("240615"), or "" on invalid input
 *
 * @example formatSwiftDate("2024-06-15") // "240615"
 * @example formatSwiftDate("2001-01-01") // "010101"
 * @example formatSwiftDate("2060-12-31") // "601231"
 * @example formatSwiftDate("2004-02-29") // "040229"
 * @example formatSwiftDate("2000-12-31") // "" (before 2001)
 * @example formatSwiftDate("2061-01-01") // "" (after 2060)
 * @example formatSwiftDate("2024-06-15T10:00:00") // "" (a date-time: take the date first)
 */
export function formatSwiftDate(value: string): string {
  try {
    if (typeof value !== "string" || !isDateString(value)) {
      return "";
    }
    const date = Temporal.PlainDate.from(value);
    if (
      date.year < SWIFT_VALUE_DATE_FIRST_YEAR ||
      date.year > SWIFT_VALUE_DATE_LAST_YEAR
    ) {
      return "";
    }
    return writeSwiftDate(date.year, date.month, date.day);
  } catch {
    return "";
  }
}
