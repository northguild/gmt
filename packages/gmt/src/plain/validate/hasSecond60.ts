import { hasSecond60Shape } from "../../internal/isoStringBody";

/**
 * Return true if the string is one of GMT's own kinds with a second-60 field.
 *
 * - The kinds are a plain time, a plain date-time, a UTC or offset instant, a zoned date-time (one
 *   time zone bracket) and a calendar-aware date-time (at most one `u-ca`), each in GMT's strict
 *   extended ISO 8601 shape over the whole string, with the seconds written as `60`
 *   (`"23:59:60"`, `"2016-12-31T23:59:60Z"`, `"2016-12-31T23:59:60+00:00[UTC]"`).
 * - It is a syntactic test of the seconds field, the spelling Temporal would silently clamp to
 *   `:59`. It does not check the IERS leap-second list: a real leap second exists only at
 *   23:59:60 UTC at the end of a month in which one was inserted (RFC 3339 §5.7), so
 *   `"2024-12-31T23:59:60Z"` (no leap second that day, IERS Bulletin C 68) and
 *   `"2024-06-15T12:34:60Z"` both return true. For that, use `isLeapSecond` from `timescale/`.
 * - Accepts optional fractional seconds, after `.` or `,`.
 * - Returns false for every other spelling, even ones Temporal would clamp: a lower-case `t` or a
 *   space separator, basic format, a time with a leading `T` or an offset, a `[key=value]`
 *   annotation other than `u-ca`, a second annotation, trailing text and whitespace. Those are
 *   not GMT kinds, and the function that reads each kind rejects them on its own.
 *
 * @param value candidate string
 * @returns true when the whole string is a GMT kind with a second-60 field, otherwise false
 *
 * @example hasSecond60("2016-12-31T23:59:60Z") // true
 * @example hasSecond60("2016-12-31T23:59:60.123Z") // true
 * @example hasSecond60("2016-12-31T23:59:60+00:00") // true
 * @example hasSecond60("2016-12-31T23:59:60+00:00[UTC]") // true (zoned)
 * @example hasSecond60("2016-12-31T23:59:60") // true (plain date-time)
 * @example hasSecond60("23:59:60") // true (plain time)
 * @example hasSecond60("2016-12-31T23:59:59Z") // false
 * @example hasSecond60("2016-12-31t23:59:60Z") // false (lower-case t is not a GMT shape)
 * @example hasSecond60("20161231 235960Z") // false (space separator, basic format)
 * @example hasSecond60("2016-12-31T23:59:60Z[foo=bar]") // false (an annotation GMT has no kind for)
 */
export function hasSecond60(value: string): boolean {
  return hasSecond60Shape(value);
}
