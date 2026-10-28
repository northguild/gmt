import { plainYearMonthOf } from "../../internal/inputChecks";
import { yearMonthString } from "../../internal/yearMonth";

/**
 * Return the canonical `YYYY-MM` form of an ISO year-month string (`±YYYYYY-MM` outside
 * 0000-9999).
 *
 * - Reads `YYYY-MM` and `±YYYYYY-MM`; writes the shortest form. The reference day is never
 *   written.
 * - The extended form only: `202610` is refused, as `isValidDate` refuses `20241225`.
 * - A date such as `2026-10-01` is not a year-month: use `parseYearMonthFromDate`.
 * - The range is Temporal's: `-271821-04` to `+275760-09`.
 * - Annotations are read as `isValidYearMonth` reads them: elective and time zone annotations
 *   are ignored, an unknown critical one refuses, and `u-ca` must be `iso8601` in any case.
 * - Returns "" for invalid input.
 *
 * @param value ISO year-month string
 * @returns the `YYYY-MM` string, or "" on invalid input
 *
 * @example parseYearMonth("2026-10") // "2026-10"
 * @example parseYearMonth("+002026-10") // "2026-10"
 * @example parseYearMonth("-000001-12") // "-000001-12"
 * @example parseYearMonth("2026-10[u-ca=ISO8601]") // "2026-10"
 * @example parseYearMonth("+275760-10") // ""
 * @example parseYearMonth("202610") // ""
 * @example parseYearMonth("2026-10-01") // ""
 */
export function parseYearMonth(value: string): string {
  const yearMonth = plainYearMonthOf(value);
  return yearMonth === null ? "" : yearMonthString(yearMonth);
}
