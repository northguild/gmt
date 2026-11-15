import { plainYearMonthOf } from "../../internal/inputChecks";

/**
 * Return true if `value` is a valid ISO year-month string: `YYYY-MM` or `±YYYYYY-MM`.
 *
 * - The whole string must match `plainYearMonth`: the extended form only
 *   (`202610` is refused, as `isValidDate` refuses `20241225`), a four-digit year or a sign and
 *   six digits, never `-000000`.
 * - The range is Temporal's: `-271821-04` to `+275760-09`.
 * - A date such as `2026-10-01` is not a year-month: use `parseYearMonthFromDate`.
 * - Accepts no annotation of any kind: a time zone, a calendar (`[u-ca=iso8601]`) or an
 *   elective one (`[foo=bar]`) returns `false`.
 * - Rejects a time, a `Z` and an offset.
 * - A value that is not a string, a `String` object included, returns `false`. A `true` result
 *   narrows an `unknown` value to `string`.
 *
 * @param value any value; a string is checked as an ISO year-month
 * @returns boolean indicating validity
 *
 * @example isValidYearMonth("2026-10") // true
 * @example isValidYearMonth("+275760-09") // true (the latest year-month)
 * @example isValidYearMonth("2026-10[u-ca=ISO8601]") // false (no annotation of any kind)
 * @example isValidYearMonth("+275760-10") // false (outside Temporal's range)
 * @example isValidYearMonth("202610") // false (basic format)
 * @example isValidYearMonth("2026-13") // false (month 13)
 * @example isValidYearMonth("2026-10-01") // false (a date, not a year-month)
 * @example isValidYearMonth("2026-10[u-ca=gregory]") // false (no annotation of any kind)
 * @example isValidYearMonth("") // false
 * @example isValidYearMonth(null) // false
 */
export function isValidYearMonth(value: string): boolean;
export function isValidYearMonth(value: {} | null | undefined | void): boolean;
export function isValidYearMonth(value: unknown): value is string;
export function isValidYearMonth(value: unknown): boolean {
  return plainYearMonthOf(value) !== null;
}
