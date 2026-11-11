import type { TimeScale } from "../../types/time-scale";
import {
  dayPositionOf,
  epochDaysOfJ2000Seconds,
  isTimeScale,
  J2000_EPOCH_DAY,
  LEAP_SECOND_STEPS,
  NANOSECONDS_PER_DAY,
  NANOSECONDS_PER_SECOND,
  nearestDouble,
  parseUtcReading,
  readsBackInDomain,
} from "../../internal";

/**
 * Convert a UTC instant to seconds since J2000.0 on a time scale. **The scale defaults to
 * `"TT"`, unlike the Julian Date and MJD functions, which default to `"UTC"`**: J2000.0 is
 * defined as 2000-01-01T12:00:00 TT (IAU 1994 Resolution C7).
 *
 * - The result is (JD on the scale − 2451545.0) × 86 400 (ERFA `ERFA_DJ00`, `ERFA_DAYSEC`).
 *   On `"TT"` it counts TT seconds from J2000.0 itself; on `"TAI"` and `"TCG"` it counts from
 *   the label `2000-01-01T12:00:00` on that scale.
 * - On `"UTC"` it is the quasi-JD count (ERFA `dtf2d.c` Notes 4 and 7). On every day without a
 *   leap second it equals Unix seconds minus 946 728 000. On a day with one, the 86 401 s are
 *   scaled to fill 86 400, so, like Unix time, the difference between two UTC values is not an
 *   exact interval.
 * - TDB is not available, so this is not the "ephemeris seconds past J2000", which count on TDB.
 * - Precision: the result is the double nearest the exact count (rounded once, ties to even), so
 *   the error is at most half an ulp of the result. Seconds since J2000 in one double keep
 *   a spacing (ulp) of at most 2⁻²³ s (0.12 µs) for |seconds| < 2³⁰ (about 1966 to 2034), so a
 *   value is off by at most 0.06 µs (half an ulp), and a spacing of 30.5 µs at year 9999, a
 *   value off by at most 15 µs. Callers
 *   needing nanoseconds should use `toJulianDateParts`.
 * - Accepts any offset or bracketed zone, and a listed leap second `…T23:59:60Z`.
 * - Domain: 1972-01-01T00:00:00Z to 9999-12-31T23:59:59.999999999Z UTC; `null` outside it. Within
 *   about 15 µs (half an ulp) of the end of 9999 (on UTC, TAI and TCG) it also returns `null`, because the
 *   nearest double lies past the domain and `fromJ2000Seconds` would reject it;
 *   `toJulianDateParts` covers the whole domain exactly.
 *
 * @param isoString ISO 8601 instant string
 * @param scale the time scale to count on, default `"TT"`
 * @returns seconds since J2000.0 (negative before it), or null on invalid input, an unknown scale or an instant outside the domain
 *
 * @example toJ2000Seconds("2000-01-01T11:58:55.816Z") // 0 — J2000.0 itself
 * @example toJ2000Seconds("2000-01-01T12:00:00Z") // 64.184
 * @example toJ2000Seconds("2000-01-01T12:00:00Z", "UTC") // 0
 * @example toJ2000Seconds("2026-01-01T00:00:00Z", "TAI") // 820497637
 * @example toJ2000Seconds("1971-12-31T23:59:59Z") // null — before 1972
 */
export function toJ2000Seconds(
  isoString: string,
  scale: TimeScale = "TT",
): number | null {
  try {
    if (!isTimeScale(scale)) {
      return null;
    }
    const reading = parseUtcReading(isoString);
    if (reading === null) {
      return null;
    }
    const position = dayPositionOf(LEAP_SECOND_STEPS, reading, scale);
    if (position === null) {
      return null;
    }
    const { epochDay, nanosOfDay, dayLength } = position;
    // Exact seconds since J2000.0 (noon of day 10 957): the day's start plus the part of the day
    // gone, nanosOfDay / dayLength of a day (on UTC a day of 86 401 s still counts as one, ERFA
    // dtf2d.c Note 4). As one fraction, (start × dayLength + nanosOfDay × DAY) / (dayLength × 10^9),
    // rounded to a double once; on a day of 86 400 s it reduces to start + nanosOfDay over 10^9.
    const start =
      (epochDay - J2000_EPOCH_DAY) * NANOSECONDS_PER_DAY -
      NANOSECONDS_PER_DAY / 2n;
    const seconds = nearestDouble(
      start * dayLength + nanosOfDay * NANOSECONDS_PER_DAY,
      dayLength * NANOSECONDS_PER_SECOND,
    );
    return readsBackInDomain(
      epochDaysOfJ2000Seconds(seconds),
      LEAP_SECOND_STEPS,
      scale,
    )
      ? seconds
      : null;
  } catch {
    return null;
  }
}
