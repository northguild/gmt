import { plainDateTimeOf } from "../../internal/inputChecks";

/**
 * Return true when `value` is a valid PlainDateTime string.
 *
 * - The whole string must match `plainDateTime`.
 * - Accepts no annotation of any kind: a time zone, a calendar (`[u-ca=iso8601]`) or an
 *   elective one (`[foo=bar]`) returns `false`.
 * - Rejects leap seconds (e.g., "2024-02-29T23:59:60").
 * - Rejects invalid dates (e.g., "2024-02-30") and invalid times (e.g., "2024-02-29T24:00:00").
 * - A value that is not a string, a `String` object included, returns `false`. A `true` result
 *   narrows an `unknown` value to `string`.
 *
 * @param value any value; a string is checked as an ISO PlainDateTime
 * @returns boolean indicating whether the value is a valid PlainDateTime string
 *
 * @example isValidDateTime("2024-02-29T12:34:56") // true
 * @example isValidDateTime("2024-02-30T12:34:56") // false (invalid date)
 * @example isValidDateTime("2024-02-29T12:34:56[Asia/Kolkata]") // false (no annotation of any kind)
 * @example isValidDateTime("2024-02-29T12:34:56[!foo=bar]") // false (no annotation of any kind)
 * @example isValidDateTime("2024-02-29T12:34:56[u-ca=hebrew]") // false (no annotation of any kind)
 * @example isValidDateTime("2024-02-29T24:00:00") // false (invalid time)
 * @example isValidDateTime("2024-02-29T23:59:60") // false (leap second)
 * @example isValidDateTime(null) // false
 */
export function isValidDateTime(value: string): boolean;
export function isValidDateTime(value: {} | null | undefined | void): boolean;
export function isValidDateTime(value: unknown): value is string;
export function isValidDateTime(value: unknown): boolean {
  return plainDateTimeOf(value) !== null;
}
