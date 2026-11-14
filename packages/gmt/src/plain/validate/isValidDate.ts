import { plainDateOf } from "../../internal/inputChecks";

/**
 * Return true if `value` is a valid ISO PlainDate string.
 *
 * - The whole string must match `plainDate` (a date, not a date-time).
 * - Accepts no annotation of any kind: a time zone (`[Europe/Paris]`), a calendar
 *   (`[u-ca=iso8601]`, `[u-ca=hebrew]`) or an elective one (`[foo=bar]`) returns `false`.
 *   `isValidCalendarDate` is the validator that reads a calendar.
 * - Rejects leap seconds (e.g., "2024-12-31T23:59:60").
 * - Rejects invalid dates (e.g., "2024-02-30").
 * - A value that is not a string, a `String` object included, returns `false`. A `true` result
 *   narrows an `unknown` value to `string`.
 *
 * @param value any value; a string is checked as an ISO PlainDate
 * @returns boolean indicating validity
 *
 * @example isValidDate("2024-03-10") // true
 * @example isValidDate("2024-02-30") // false
 * @example isValidDate("2024-03-10[u-ca=iso8601]") // false (no annotation of any kind)
 * @example isValidDate("2024-03-10[foo=bar]") // false (elective annotation)
 * @example isValidDate("2024-03-10[!foo=bar]") // false (unknown critical annotation)
 * @example isValidDate("2024-03-10[u-ca=hebrew]") // false (use isValidCalendarDate)
 * @example isValidDate("invalid") // false
 * @example isValidDate("2024-12-31T23:59:60") // false (leap second - not a valid date)
 * @example isValidDate(null) // false
 */
export function isValidDate(value: string): boolean;
export function isValidDate(value: {} | null | undefined | void): boolean;
export function isValidDate(value: unknown): value is string;
export function isValidDate(value: unknown): boolean {
  return plainDateOf(value) !== null;
}
