import type { TimeScale } from "../../types/time-scale";
import {
  dayPositionOf,
  epochDaysOfModifiedJulianDate,
  isTimeScale,
  LEAP_SECOND_STEPS,
  MJD_OF_UNIX_EPOCH,
  nearestDouble,
  parseUtcReading,
  readsBackInDomain,
} from "../../internal";

/**
 * Convert a UTC instant to a Modified Julian Date on a time scale. The scale defaults to `"UTC"`.
 *
 * - MJD = JD − 2 400 000.5 and counts from midnight, not noon (ITU-R TF.457-2 Rec. 2): midnight is
 *   a whole number, and J2000.0 (noon) is 51544.5.
 * - One double. For present-day dates it keeps about 64 times the resolution of a single-double
 *   JD (about 0.6 µs against 40 µs), so it suits a system that takes only one number. The error is
 *   at most ½ ulp(MJD) days: 2⁻³⁸ day (0.31 µs) from 1972 to 2038-04-22, 0.63 µs to about 2217,
 *   doubling with each later doubling of the MJD, up to 20.1 µs (2⁻³² day) by year 9999, as MJD
 *   stays below 2²². For nanoseconds use `toJulianDateParts`.
 * - The result is the exact day number plus fraction of the day, rounded once to the nearest
 *   double, ties to even; never `JD − 2400000.5` in doubles, which would lose the digits MJD exists
 *   to keep.
 * - On `"UTC"` the count is ERFA's quasi-MJD: a leap-second day counts as one day, so the
 *   difference between two UTC values is not an exact interval (ERFA `dtf2d.c` Notes 4 and 7). On
 *   `"TAI"`, `"TT"` and `"TCG"` it is read from the label `toTAI` / `toTT` / `toTCG` writes. TDB
 *   is not available.
 * - Accepts any offset or bracketed zone, and a listed leap second `…T23:59:60Z`.
 * - Domain: 1972-01-01T00:00:00Z to 9999-12-31T23:59:59.999999999Z UTC; `null` outside it. Within
 *   about 20 µs of the end of 9999 (on UTC, TAI and TT) or a fraction of a µs of 1972-01-01 (on
 *   TAI and TT) it also returns `null`, because the nearest double lies outside the domain (the
 *   last nanosecond of 9999 would give 2973484, which is 10000-01-01) and `fromModifiedJulianDate`
 *   would reject it; `toJulianDateParts` covers the whole domain exactly.
 *
 * @param isoString ISO 8601 instant string
 * @param scale the time scale to count on, default `"UTC"`
 * @returns the Modified Julian Date, or null on invalid input, an unknown scale or an instant outside the domain
 *
 * @example toModifiedJulianDate("2000-01-01T00:00:00Z") // 51544
 * @example toModifiedJulianDate("2000-01-01T12:00:00Z") // 51544.5
 * @example toModifiedJulianDate("2000-01-01T11:58:55.816Z", "TT") // 51544.5
 * @example toModifiedJulianDate("2026-01-01T00:00:00Z", "TAI") // 61041.00042824... (61041 + 37 / 86400)
 * @example toModifiedJulianDate("1971-12-31T23:59:59Z") // null — before 1972
 */
export function toModifiedJulianDate(
  isoString: string,
  scale: TimeScale = "UTC",
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
    // MJD = epochDay + 40 587 + nanosOfDay / dayLength, as one fraction, rounded once.
    const mjd = nearestDouble(
      (epochDay + MJD_OF_UNIX_EPOCH) * dayLength + nanosOfDay,
      dayLength,
    );
    return readsBackInDomain(
      epochDaysOfModifiedJulianDate(mjd),
      LEAP_SECOND_STEPS,
      scale,
    )
      ? mjd
      : null;
  } catch {
    return null;
  }
}
