import { plainDateOf } from "../../internal/inputChecks";
import { yearMonthString } from "../../internal/yearMonth";

/**
 * Return the year-month (`YYYY-MM`) of an ISO 8601 date string.
 *
 * - The day is dropped, so `2026-10-01` and `2026-10-31` give the same year-month.
 * - Only the ISO calendar is read; a Hebrew or Islamic date gives `""`.
 * - Returns "" for invalid input.
 *
 * @param value ISO date string
 * @returns The canonical `YYYY-MM` string (`±YYYYYY-MM` outside 0000-9999), or "" on invalid input
 *
 * @example parseYearMonthFromDate("2026-10-01") // "2026-10"
 * @example parseYearMonthFromDate("2026-10-31") // "2026-10"
 * @example parseYearMonthFromDate("+275760-09-13") // "+275760-09"
 * @example parseYearMonthFromDate("2023-02-29") // ""
 * @example parseYearMonthFromDate("2026-10-01[u-ca=hebrew]") // ""
 */
export function parseYearMonthFromDate(value: string): string {
  const valueParsed = plainDateOf(value);
  if (valueParsed === null) return "";

  try {
    return yearMonthString(valueParsed.toPlainYearMonth());
  } catch {
    return "";
  }
}
