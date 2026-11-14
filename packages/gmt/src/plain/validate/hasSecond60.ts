import { calendarDateOf } from "../../internal/calendarDateString";
import { calendarZonedOf } from "../../internal/calendarZonedString";
import { plainDateTimeOf, plainTimeOf } from "../../internal/inputChecks";
import { hasSecond60Shape } from "../../internal/isoStringBody";
import { readInstantOffsetInstant } from "../../internal/offsetInstant";
import { utcInstantOf } from "../../internal/utcInstant";
import { zonedDateTimeOf } from "../../internal/zonedWallClock";

/** The first time of day's seconds, `60`, read as `59`; a fraction stays. The shape put it there. */
const SECOND_60 = /(\d{2}:\d{2}:)60/;

/**
 * Return true if the string is one of GMT's own kinds with a second-60 field.
 *
 * - The kinds are a plain time, a plain date-time, a UTC or offset instant, a zoned date-time (one
 *   time zone bracket) and a calendar-aware date-time (at most one `u-ca`), each in GMT's strict
 *   extended ISO 8601 shape over the whole string, with the seconds written as `60`
 *   (`"23:59:60"`, `"2016-12-31T23:59:60Z"`, `"2016-12-31T23:59:60+00:00[UTC]"`).
 * - The string must also be a valid value of its kind with the `60` read as `59`, the value
 *   Temporal would silently clamp to, by the exact reader for that kind: the date must exist, a
 *   zone must exist and agree with a written offset, and a calendar must be one GMT knows. So
 *   `"2016-02-30T23:59:60"`, `"2016-12-31T23:59:60+00:00[Not/AZone]"` and
 *   `"2016-12-31T23:59:60[u-ca=notacal]"` return false. It does not check the IERS leap-second list: a real leap second exists only at
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
 * @example hasSecond60("2016-12-31T23:59:60,5Z") // true (comma fraction)
 * @example hasSecond60("2016-12-31T23:59:60[u-ca=hebrew]") // true (calendar date-time)
 * @example hasSecond60("2016-02-30T23:59:60") // false (no such day)
 * @example hasSecond60("2016-12-31T23:59:60+00:00[Not/AZone]") // false (unknown zone)
 * @example hasSecond60("2016-12-31T23:59:60[u-ca=notacal]") // false (unknown calendar)
 * @example hasSecond60("2016-12-31T23:59:59Z") // false
 * @example hasSecond60("2016-12-31t23:59:60Z") // false (lower-case t is not a GMT shape)
 * @example hasSecond60("20161231 235960Z") // false (space separator, basic format)
 * @example hasSecond60("2016-12-31T23:59:60Z[foo=bar]") // false (an annotation GMT has no kind for)
 */
export function hasSecond60(value: string): boolean {
  if (!hasSecond60Shape(value)) {
    return false;
  }
  const clamped = value.replace(SECOND_60, (_, head: string) => `${head}59`);
  return (
    plainTimeOf(clamped) !== null ||
    plainDateTimeOf(clamped) !== null ||
    utcInstantOf(clamped) !== null ||
    readInstantOffsetInstant(clamped) !== null ||
    zonedDateTimeOf(clamped) !== null ||
    calendarZonedOf(clamped) !== null ||
    calendarDateOf(clamped) !== null
  );
}
