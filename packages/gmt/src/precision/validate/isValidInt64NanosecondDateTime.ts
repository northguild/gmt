import { fitsInt64, wallClockNanoseconds } from "../../internal";

/**
 * Validate whether a string is a plain date-time whose epoch-nanosecond count, read as if it
 * were UTC (Arrow's rule for a zoneless timestamp), fits an `int64`: the check to run before
 * `toArrowLocalTimestamp(dateTime, "nanosecond")`.
 *
 * An `int64` of nanoseconds covers only `1677-09-21T00:12:43.145224192` to
 * `2262-04-11T23:47:16.854775807`. `toArrowLocalTimestamp` returns `0n` outside it, which is
 * also the epoch, so a caller cannot tell the failure from a real zero without this check.
 *
 * - Accepts the plain date-time strings `isValidDateTime` accepts, then applies the range.
 *   A zone annotation is ignored; an offset or `Z` is rejected.
 * - An empty string returns `false`.
 * - A value that is not a string, a `String` object included, returns `false`. A `true` result
 *   narrows an `unknown` value to `string`.
 *
 * @param dateTime any value; a string is checked as an ISO 8601 plain date-time
 * @returns boolean indicating whether it is a plain date-time and its nanosecond count fits an `int64`
 *
 * @example isValidInt64NanosecondDateTime("2024-01-01T00:00:00") // true
 * @example isValidInt64NanosecondDateTime("1677-09-21T00:12:43.145224192") // true — the first nanosecond
 * @example isValidInt64NanosecondDateTime("2262-04-11T23:47:16.854775807") // true — the last nanosecond
 * @example isValidInt64NanosecondDateTime("2262-04-11T23:47:16.854775808") // false — one past
 * @example isValidInt64NanosecondDateTime("+010000-01-01T00:00:00") // false — a valid date-time, too far
 * @example isValidInt64NanosecondDateTime("2024-01-01T00:00:00Z") // false — an instant
 * @example isValidInt64NanosecondDateTime(null) // false
 */
export function isValidInt64NanosecondDateTime(dateTime: string): boolean;
export function isValidInt64NanosecondDateTime(
  dateTime: {} | null | undefined | void,
): boolean;
export function isValidInt64NanosecondDateTime(
  dateTime: unknown,
): dateTime is string;
export function isValidInt64NanosecondDateTime(dateTime: unknown): boolean {
  return fitsInt64(wallClockNanoseconds(dateTime));
}
