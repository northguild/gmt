import type { TimeScale } from "../../types/time-scale";
import {
  dayPositionOfDays,
  epochDaysOfJulianDate,
  formatUtcReading,
  isTimeScale,
  LEAP_SECOND_STEPS,
  readingOfDayPosition,
} from "../../internal";

/**
 * Convert a single Julian Date on a time scale to a UTC instant string. The scale defaults to
 * `"UTC"`.
 *
 * - The inverse of `toJulianDate`. The double is read exactly (`jd − 2440587.5` days since
 *   1970-01-01) and rounded once to the nearest nanosecond, a half rounding up (Temporal's
 *   `halfExpand`), so the only loss is the one already in `jd`: a double near JD 2 460 000 is
 *   spaced about 40 µs apart. For nanosecond precision use `fromJulianDateParts`.
 * - JD days begin at noon: `2451544.5` is midnight UTC.
 * - On `"UTC"` the count is ERFA's quasi-JD, the same as `toJulianDateParts`: a day with a leap
 *   second counts as one day. On `"TAI"`, `"TT"` and `"TCG"` it is a true JD. TDB is not available.
 * - Returns `"Z"` form with Temporal's shortest fraction, and `…:60` inside an inserted second.
 * - `jd` must be a finite number; a bigint, a numeric string, `NaN` or `Infinity` gives "".
 * - Domain: 1972-01-01T00:00:00Z to 9999-12-31T23:59:59.999999999Z UTC; "" outside it.
 *
 * @param jd the Julian Date
 * @param scale the time scale the date is counted on, default `"UTC"`
 * @returns ISO 8601 UTC instant string (`Z`), or "" on invalid input, an unknown scale or a date outside the domain
 *
 * @example fromJulianDate(2451545) // "2000-01-01T12:00:00Z"
 * @example fromJulianDate(2451545, "TT") // "2000-01-01T11:58:55.816Z"
 * @example fromJulianDate(2451544.5) // "2000-01-01T00:00:00Z"
 * @example fromJulianDate(2461042 + 2 ** -31) // "2026-01-01T12:00:00.000040233Z"
 * @example fromJulianDate(2441317.4) // "" — before 1972
 * @example fromJulianDate(NaN) // ""
 */
export function fromJulianDate(jd: number, scale: TimeScale = "UTC"): string {
  try {
    if (!isTimeScale(scale) || typeof jd !== "number" || !Number.isFinite(jd)) {
      return "";
    }
    const days = epochDaysOfJulianDate(jd);
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
