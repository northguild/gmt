import { rfc3339DateTime } from "../../regex/rfc-3339";
import { isValidUtc } from "./isValidUtc";

/**
 * Return true when `value` is a real UTC instant written as `YYYY-MM-DDTHH:MM:SS[.f]Z` and
 * nothing else: a narrower check than `isValidUtc`.
 *
 * - The shape is one spelling of the RFC 3339 §5.6 `date-time`: a four-digit year, `0000` to
 *   `9999` (`date-fullyear = 4DIGIT`), an upper-case `T`, a time with seconds, an optional
 *   fraction of one to nine digits after a dot (`time-secfrac = "." 1*DIGIT`; GMT stops at nine
 *   because Temporal keeps nanoseconds), and an upper-case `Z` with nothing after it.
 * - Use it for a string headed for storage, or for a reader that is not Temporal: the shape is
 *   plain RFC 3339, and the one `Temporal.Instant.prototype.toString()`, called with no options,
 *   writes for years `0000` to `9999`.
 * - Use `isValidUtc` when Temporal is the only reader. It also accepts a time without seconds, a
 *   comma before the fraction, an expanded `±YYYYYY` year and RFC 9557 annotations; all four are
 *   false here.
 * - A subset of `isValidUtc`: every string that is true here is true there. The instant is
 *   checked as well as the shape, so a day that does not exist is false.
 * - False for the other spellings §5.6 allows: a lower-case `t` or `z`, a space for `T` (its
 *   NOTE), and a numeric offset, `+00:00` included. `isValidRfc3339DateTime` checks the whole
 *   grammar, with the same two GMT limits.
 * - False for a leap second (`:60`), although §5.6 `time-second` admits it: GMT rejects leap
 *   seconds because Temporal would read one as `:59`.
 * - Not one canonical spelling: `12:00:00Z` and `12:00:00.000Z` are one instant and both are
 *   true. A reader may still refuse or round a string that is true here: PostgreSQL has no year
 *   `0000` and keeps microseconds. See `toPgMicroseconds` and `precision/`.
 * - False for a non-string.
 *
 * @param value candidate UTC timestamp string
 * @returns true when `value` is a real UTC instant in this shape, or false on invalid input
 *
 * @example isValidUtcTimestamp("2026-10-06T12:00:00Z") // true
 * @example isValidUtcTimestamp("2026-10-06T12:00:00.123456789Z") // true (nine fraction digits)
 * @example isValidUtcTimestamp("0000-01-01T00:00:00Z") // true (year 0000)
 * @example isValidUtcTimestamp("2026-10-06T12:00:00Z[Europe/Paris]") // false (RFC 9557 annotation; isValidUtc accepts it)
 * @example isValidUtcTimestamp("2026-10-06T12:00:00,5Z") // false (comma before the fraction; isValidUtc accepts it)
 * @example isValidUtcTimestamp("-005000-01-01T00:00:00Z") // false (expanded year; isValidUtc accepts it)
 * @example isValidUtcTimestamp("2026-10-06T12:00Z") // false (no seconds; isValidUtc accepts it)
 * @example isValidUtcTimestamp("2026-10-06t12:00:00z") // false (lower-case t and z)
 * @example isValidUtcTimestamp("2026-10-06T12:00:00+00:00") // false (a numeric offset, not Z)
 * @example isValidUtcTimestamp("2026-02-30T00:00:00Z") // false (February has no 30th; the rfc3339DateTime pattern matches it)
 * @example isValidUtcTimestamp("2016-12-31T23:59:60Z") // false (leap second)
 * @example isValidUtcTimestamp("not a date") // false
 */
export function isValidUtcTimestamp(value: string): boolean {
  // `isValidUtc` goes first: it stops a non-string before the pattern would read it as text.
  return isValidUtc(value) && rfc3339DateTime.test(value);
}
