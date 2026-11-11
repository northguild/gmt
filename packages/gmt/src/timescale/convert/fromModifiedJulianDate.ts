import type { TimeScale } from "../../types/time-scale";
import {
  dayPositionOfDays,
  epochDaysOfModifiedJulianDate,
  formatUtcReading,
  isTimeScale,
  LEAP_SECOND_STEPS,
  readingOfDayPosition,
} from "../../internal";

/**
 * Convert a Modified Julian Date on a time scale to a UTC instant string. The scale defaults to
 * `"UTC"`.
 *
 * - The inverse of `toModifiedJulianDate`. The double is read exactly (`mjd − 40587` days since
 *   1970-01-01), then rounded once to the nearest nanosecond, a half rounding up (Temporal's
 *   `halfExpand`).
 * - MJD = JD − 2 400 000.5 and counts from midnight, not noon: `51544` is midnight, `51544.5` noon.
 * - One double carries at most ½ ulp(MJD) + ½ ulp(fraction) days of error: 0.31 µs for 1972 to
 *   2038-04-22, growing to 20.1 µs (2⁻³² day) by year 9999, as MJD stays below 2²². For nanoseconds use `fromJulianDateParts`.
 * - On `"UTC"` the count is ERFA's quasi-MJD: a day with a leap second counts as one day, so on a
 *   leap-second day the fraction 86400/86401 of the day is where `…T23:59:60Z` begins. On
 *   `"TAI"`, `"TT"` and `"TCG"` it is a true count. TDB is not available.
 * - Returns `"Z"` form with Temporal's shortest fraction, and `…:60` inside an inserted second.
 * - `mjd` must be a finite number; a bigint, a numeric string, `NaN` or `Infinity` gives "".
 * - Domain: 1972-01-01T00:00:00Z to 9999-12-31T23:59:59.999999999Z UTC; "" outside it.
 *
 * @param mjd the Modified Julian Date
 * @param scale the time scale the date is counted on, default `"UTC"`
 * @returns ISO 8601 UTC instant string (`Z`), or "" on invalid input, an unknown scale or a date outside the domain
 *
 * @example fromModifiedJulianDate(51544) // "2000-01-01T00:00:00Z"
 * @example fromModifiedJulianDate(51544.5, "TT") // "2000-01-01T11:58:55.816Z"
 * @example fromModifiedJulianDate(57753.5) // "2016-12-31T12:00:00.5Z"
 * @example fromModifiedJulianDate(41316.99) // "" — before 1972
 * @example fromModifiedJulianDate(NaN) // ""
 */
export function fromModifiedJulianDate(
  mjd: number,
  scale: TimeScale = "UTC",
): string {
  try {
    if (
      !isTimeScale(scale) ||
      typeof mjd !== "number" ||
      !Number.isFinite(mjd)
    ) {
      return "";
    }
    const days = epochDaysOfModifiedJulianDate(mjd);
    const position = dayPositionOfDays(
      days.numerator,
      days.denominator,
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
