import { fitsInt64, parseInstantNanoseconds } from "../../internal";

/**
 * Validate whether a string is an instant whose epoch-nanosecond count fits an `int64`: the
 * check to run before `toArrowTimestamp(isoString, "nanosecond")`.
 *
 * An `int64` of nanoseconds covers only `1677-09-21T00:12:43.145224192Z` to
 * `2262-04-11T23:47:16.854775807Z`. `toArrowTimestamp` returns `0n` outside it, which is also
 * the epoch, so a caller cannot tell the failure from a real zero without this check. Seconds,
 * milliseconds and microseconds cover the whole Temporal range, so `isValidInstant` is enough
 * for them.
 *
 * - Accepts exactly the instant strings `isValidInstant` accepts, then applies the range.
 * - Returns `false` for non-strings and empty strings.
 *
 * @param isoString candidate ISO 8601 instant string
 * @returns boolean indicating whether it is an instant and its nanosecond count fits an `int64`
 *
 * @example isValidInt64NanosecondInstant("2024-01-01T00:00:00Z") // true
 * @example isValidInt64NanosecondInstant("1677-09-21T00:12:43.145224192Z") // true — the first nanosecond
 * @example isValidInt64NanosecondInstant("2262-04-11T23:47:16.854775807Z") // true — the last nanosecond
 * @example isValidInt64NanosecondInstant("2262-04-11T23:47:16.854775808Z") // false — one past
 * @example isValidInt64NanosecondInstant("+010000-01-01T00:00:00Z") // false — a valid instant, too far
 * @example isValidInt64NanosecondInstant("2024-01-01T00:00:00") // false — no offset
 */
export function isValidInt64NanosecondInstant(isoString: string): boolean {
  return fitsInt64(parseInstantNanoseconds(isoString));
}
