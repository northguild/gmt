import { leapSecond } from "../../regex/leap-second";

/**
 * Return true if the provided ISO 8601 date-time or time string has a second-60 field.
 *
 * - This is a syntactic test of the seconds field, the spelling Temporal would silently clamp to
 *   `:59`. It does not check the IERS leap-second list: a real leap second exists only at
 *   23:59:60 UTC at the end of a month in which one was inserted (RFC 3339 §5.7), so
 *   `"2024-12-31T23:59:60Z"` (no leap second that day, IERS Bulletin C 68) and
 *   `"2024-06-15T12:34:60Z"` both return true.
 * - Matches a seconds field of `60` with any date, time of day or offset, or none, for example
 *   "YYYY-MM-DDT23:59:60Z", "YYYY-MM-DDT23:59:60+00:00", "YYYY-MM-DDT23:59:60" or "23:59:60".
 * - Accepts optional fractional seconds.
 * - Accepts every spelling Temporal's grammar parses: a `T`, `t` or space separator, and
 *   extended or basic digits, a bare time with or without a `T` designator, and a designator,
 *   annotation or nothing after the second. Temporal silently clamps each of them to `:59`, so
 *   each is a leap second GMT has to catch. A `[key=value]` annotation value is never read as a time.
 * - Compatibility: earlier releases recognised only an uppercase `T` with extended digits. To
 *   keep that narrower test, match `/T\d{2}:\d{2}:60(?:[.,]\d+)?[-+Zz[]/` yourself.
 *
 * @param value ISO date-time or time string
 * @returns true when the string has a second-60 field, otherwise false
 *
 * @example isLeapSecond("2016-12-31T23:59:60Z") // true
 * @example isLeapSecond("2016-12-31T23:59:60.123Z") // true
 * @example isLeapSecond("2016-12-31T23:59:60+00:00") // true
 * @example isLeapSecond("2016-12-31T23:59:60.123+00:00") // true
 * @example isLeapSecond("2016-12-31t23:59:60Z") // true (lowercase t)
 * @example isLeapSecond("20161231 235960Z") // true (space separator, basic format)
 * @example isLeapSecond("2016-12-31T23:59:60") // true (no designator; PlainDateTime clamps it)
 * @example isLeapSecond("23:59:60") // true (a time; PlainTime clamps it)
 * @example isLeapSecond("2016-12-31T23:59:59Z") // false
 * @example isLeapSecond("2024-06-15T12:34:60Z") // true (syntactic: no leap second can occur here)
 * @example /T\d{2}:\d{2}:60(?:[.,]\d+)?[-+Zz[]/.test("2016-12-31t23:59:60Z") // false (the earlier uppercase-T-only test)
 */
export function isLeapSecond(value: string): boolean {
  return leapSecond.test(value);
}
