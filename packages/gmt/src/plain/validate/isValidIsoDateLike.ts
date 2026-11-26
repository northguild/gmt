import { isoDateLikeOf } from "../../internal/inputChecks";

/**
 * Return true when the input is a valid PlainDate or PlainDateTime ISO string.
 *
 * - Accepts both PlainDate ("2024-02-29") and PlainDateTime ("2024-02-29T12:34:56") formats.
 * - The whole string must match `plainDate` or `plainDateTime`.
 * - Accepts no annotation of any kind: a time zone, a calendar (`[u-ca=iso8601]`) or an
 *   elective one (`[foo=bar]`) returns `false`.
 * - Rejects leap seconds and invalid dates/times.
 * - A value that is not a string, a `String` object included, returns `false`. A `true` result
 *   narrows an `unknown` value to `string`.
 *
 * @param value any value; a string is checked as an ISO PlainDate or PlainDateTime
 * @returns boolean indicating validity
 *
 * @example isValidIsoDateLike("2024-02-29") // true
 * @example isValidIsoDateLike("2024-02-30") // false (invalid date)
 * @example isValidIsoDateLike("2024-02-29T12:34:56") // true
 * @example isValidIsoDateLike("2024-02-29T24:00:00") // false (invalid time)
 * @example isValidIsoDateLike("2024-12-31T23:59:60") // false (leap second)
 * @example isValidIsoDateLike("2024-02-29[u-ca=iso8601]") // false (no annotation of any kind)
 * @example isValidIsoDateLike("2024-02-29[u-ca=hebrew]") // false (no annotation of any kind)
 * @example isValidIsoDateLike(null) // false
 */
export function isValidIsoDateLike(value: string): boolean;
export function isValidIsoDateLike(
  value: {} | null | undefined | void,
): boolean;
export function isValidIsoDateLike(value: unknown): value is string;
export function isValidIsoDateLike(value: unknown): boolean {
  return isoDateLikeOf(value);
}
