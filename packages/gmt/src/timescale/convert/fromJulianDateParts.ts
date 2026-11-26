import type { JulianDateParts, TimeScale } from "../../types/time-scale";
import {
  dayPositionOfDays,
  exactDyadic,
  formatUtcReading,
  isObject,
  isTimeScale,
  JD_OF_UNIX_EPOCH_MIDNIGHT_HALF_DAYS,
  LEAP_SECOND_STEPS,
  readingOfDayPosition,
} from "../../internal";

/**
 * Convert a two-part Julian Date on a time scale to a UTC instant string. The scale defaults to
 * `"UTC"`.
 *
 * - The inverse of `toJulianDateParts`. The two doubles are read exactly and summed exactly
 *   (`jd1 + jd2 − 2440587.5` days since 1970-01-01), then rounded to the nearest nanosecond, a
 *   half rounding up (Temporal's `halfExpand`). On `"UTC"`, `"TAI"` and `"TT"` that rounds the
 *   instant. On `"TCG"` it rounds the TCG label, which `fromTCG` then maps to UTC (flooring to
 *   the TT nanosecond), so the result can be 1 ns later than the exact inverse of the date. The
 *   round trip with `toJulianDateParts` stays exact.
 * - Any split works (ERFA `jd2cal.c` Note 2): `{2451545, 0}`, `{2400000.5, 51544.5}`, `{0, 2451545}`
 *   and `{2451545.5, -0.5}` give the same instant, though a split that puts everything into one
 *   part has already lost precision in that double.
 * - JD days begin at noon: `{ jd1: 2451544, jd2: 0.5 }` is midnight UTC.
 * - On `"UTC"` the count is ERFA's quasi-JD: a day with a leap second counts as one day, so a
 *   fraction past the end of an ordinary day reads as `…T23:59:60Z` on a leap-second day. On
 *   `"TAI"`, `"TT"` and `"TCG"` it is a true JD. TDB is not available.
 * - Returns `"Z"` form with Temporal's shortest fraction, and `…:60` inside an inserted second.
 * - Both members must be finite numbers; a bigint, a numeric string, `NaN` or a missing member
 *   gives "".
 * - Domain: 1972-01-01T00:00:00Z to 9999-12-31T23:59:59.999999999Z UTC; "" outside it.
 *
 * @param parts the two-part Julian Date
 * @param scale the time scale the date is counted on, default `"UTC"`
 * @returns ISO 8601 UTC instant string (`Z`), or "" on invalid input, an unknown scale or a date outside the domain
 *
 * @example fromJulianDateParts({ jd1: 2451545, jd2: 0 }) // "2000-01-01T12:00:00Z"
 * @example fromJulianDateParts({ jd1: 2451545, jd2: 0 }, "TT") // "2000-01-01T11:58:55.816Z"
 * @example fromJulianDateParts({ jd1: 2400000.5, jd2: 51544.5 }) // "2000-01-01T12:00:00Z"
 * @example fromJulianDateParts({ jd1: 2457754, jd2: 86399 / 172802 }) // "2016-12-31T23:59:60Z"
 * @example fromJulianDateParts({ jd1: 2441317, jd2: 0.4999999 }) // "" — before 1972
 * @example fromJulianDateParts({ jd1: NaN, jd2: 0 }) // ""
 */
export function fromJulianDateParts(
  parts: JulianDateParts,
  scale: TimeScale = "UTC",
): string {
  try {
    if (!isTimeScale(scale) || !isObject(parts)) {
      return "";
    }
    const { jd1, jd2 } = parts;
    if (
      typeof jd1 !== "number" ||
      typeof jd2 !== "number" ||
      !Number.isFinite(jd1) ||
      !Number.isFinite(jd2)
    ) {
      return "";
    }
    const one = exactDyadic(jd1);
    const two = exactDyadic(jd2);
    // Common denominator 2^k; k ≥ 1 because the epoch constant is a half.
    let exponent = 1n;
    if (one.exponent > exponent) {
      exponent = one.exponent;
    }
    if (two.exponent > exponent) {
      exponent = two.exponent;
    }
    const denominator = 1n << exponent;
    const numerator =
      one.numerator * (denominator >> one.exponent) +
      two.numerator * (denominator >> two.exponent) -
      JD_OF_UNIX_EPOCH_MIDNIGHT_HALF_DAYS * (denominator >> 1n);
    const position = dayPositionOfDays(
      numerator,
      denominator,
      LEAP_SECOND_STEPS,
      scale,
    );
    if (position === null) {
      return "";
    }
    const reading = readingOfDayPosition(
      LEAP_SECOND_STEPS,
      position.epochDay,
      position.nanosOfDay,
      scale,
    );
    return reading === null ? "" : formatUtcReading(reading);
  } catch {
    return "";
  }
}
