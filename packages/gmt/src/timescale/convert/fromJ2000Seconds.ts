import type { TimeScale } from "../../types/time-scale";
import {
  dayPositionOfDays,
  epochDaysOfJ2000Seconds,
  formatUtcReading,
  isTimeScale,
  LEAP_SECOND_STEPS,
  readingOfDayPosition,
} from "../../internal";

/**
 * Convert seconds since J2000.0 on a time scale to a UTC instant string. **The scale defaults to
 * `"TT"`, unlike the Julian Date and MJD functions, which default to `"UTC"`**: J2000.0 is
 * defined as 2000-01-01T12:00:00 TT (IAU 1994 Resolution C7).
 *
 * - The inverse of `toJ2000Seconds`. The double is read exactly (days since 1970-01-01 are
 *   `(seconds + 43 200) / 86 400 + 10 957`), then rounded once to the nearest nanosecond, a half
 *   rounding up (Temporal's `halfExpand`).
 * - On `"UTC"` the count is ERFA's quasi-JD: on a day with a leap second the 86 401 s fill 86 400,
 *   so a fraction near the end of that day reads as `…T23:59:60Z`. TDB is not available.
 * - Precision: a double near 2026 resolves only to 2⁻²³ s (about 0.12 µs), so a round trip of
 *   `toJ2000Seconds` can be off by tens of nanoseconds: `820497669.184` on TT gives
 *   `2026-01-01T00:00:00.000000015Z`. Use `fromJulianDateParts` for nanosecond exactness.
 * - Returns `"Z"` form with Temporal's shortest fraction.
 * - `seconds` must be a finite number; `NaN`, `±Infinity`, a bigint or a string gives "".
 * - Domain: 1972-01-01T00:00:00Z to 9999-12-31T23:59:59.999999999Z UTC; "" outside it.
 *
 * @param seconds seconds since J2000.0 on the scale
 * @param scale the time scale the count is on, default `"TT"`
 * @returns ISO 8601 UTC instant string (`Z`), or "" on invalid input, an unknown scale or a value outside the domain
 *
 * @example fromJ2000Seconds(0) // "2000-01-01T11:58:55.816Z"
 * @example fromJ2000Seconds(0, "UTC") // "2000-01-01T12:00:00Z"
 * @example fromJ2000Seconds(820497600, "UTC") // "2026-01-01T00:00:00Z"
 * @example fromJ2000Seconds(-883656000.5, "UTC") // "" — before 1972
 * @example fromJ2000Seconds(NaN) // ""
 */
export function fromJ2000Seconds(
  seconds: number,
  scale: TimeScale = "TT",
): string {
  try {
    if (
      !isTimeScale(scale) ||
      typeof seconds !== "number" ||
      !Number.isFinite(seconds)
    ) {
      return "";
    }
    const days = epochDaysOfJ2000Seconds(seconds);
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
