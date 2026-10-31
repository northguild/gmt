import { plainYearMonthOf } from "../../internal/inputChecks";

/**
 * Return true if `value` is a valid ISO year-month string: `YYYY-MM` or `±YYYYYY-MM`.
 *
 * - The part before the first annotation must match `plainYearMonth`: the extended form only
 *   (`202610` is refused, as `isValidDate` refuses `20241225`), a four-digit year or a sign and
 *   six digits, never `-000000`.
 * - The range is Temporal's: `-271821-04` to `+275760-09`.
 * - A date such as `2026-10-01` is not a year-month: use `parseYearMonthFromDate`.
 * - Reads RFC 9557 annotations as `Temporal.PlainYearMonth.from` does: elective ones (`[foo=bar]`)
 *   and a time zone annotation are ignored, and an unknown critical one (`[!foo=bar]`) is
 *   rejected.
 * - The calendar must be `iso8601`, in any case (`[u-ca=ISO8601]` is accepted); any other
 *   calendar is refused.
 * - Rejects a time, a `Z` and an offset.
 * - A value that is not a string, a `String` object included, returns `false`. A `true` result
 *   narrows an `unknown` value to `string`.
 *
 * @param value any value; a string is checked as an ISO year-month
 * @returns boolean indicating validity
 *
 * @example isValidYearMonth("2026-10") // true
 * @example isValidYearMonth("+275760-09") // true (the latest year-month)
 * @example isValidYearMonth("2026-10[u-ca=ISO8601]") // true
 * @example isValidYearMonth("+275760-10") // false (outside Temporal's range)
 * @example isValidYearMonth("202610") // false (basic format)
 * @example isValidYearMonth("2026-13") // false (month 13)
 * @example isValidYearMonth("2026-10-01") // false (a date, not a year-month)
 * @example isValidYearMonth("2026-10[u-ca=gregory]") // false (only iso8601)
 * @example isValidYearMonth("") // false
 * @example isValidYearMonth(null) // false
 */
export function isValidYearMonth(value: string): boolean;
export function isValidYearMonth(value: {} | null | undefined | void): boolean;
export function isValidYearMonth(value: unknown): value is string;
export function isValidYearMonth(value: unknown): boolean {
  return plainYearMonthOf(value) !== null;
}
