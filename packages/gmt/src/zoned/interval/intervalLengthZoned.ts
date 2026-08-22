import { Temporal } from "@js-temporal/polyfill";
import { resolveDateTimeUnit } from "../../internal";
import { isValidDateTimeUnit } from "../../plain/validate";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { isValidZonedInterval } from "./validate";

/**
 * Return the exact length of a zoned interval in `unit`, as a real (possibly fractional) number.
 *
 * - Distinct from `intervalCountZoned`, which counts local calendar `unit` boundaries *crossed*
 *   rather than measuring exact duration — a local day that springs forward touches 1 day
 *   boundary via `intervalCountZoned` but is exactly `23/24 ≈ 0.958` days via
 *   `intervalLengthZoned`.
 * - Uses `Temporal.Duration.prototype.total` with `relativeTo` set to `start`, so the result is
 *   DST-aware: dividing a spring-forward day's length in hours returns `23`, not `24`.
 * - Returns `0` for a zero-length interval (`start === end`).
 * - Returns `null` on invalid input (unparseable start/end, `start > end`, unsupported unit,
 *   leap-second strings).
 *
 * @param start ISO 8601 zoned datetime string for the interval start
 * @param end ISO 8601 zoned datetime string for the interval end
 * @param unit unit string — any `DateTimeUnit`
 * @returns exact length of the interval expressed in `unit`, or null on invalid input
 *
 * @example intervalLengthZoned("2024-03-10T00:00:00-05:00[America/New_York]", "2024-03-11T00:00:00-04:00[America/New_York]", "hour") // 23 (spring forward)
 * @example intervalLengthZoned("2024-03-10T00:00:00-05:00[America/New_York]", "2024-03-11T00:00:00-04:00[America/New_York]", "day") // 1
 * @example intervalLengthZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-01T00:00:00+00:00[UTC]", "day") // 0
 * @example intervalLengthZoned("invalid", "2024-01-02T00:00:00+00:00[UTC]", "day") // null
 */
export function intervalLengthZoned(
  start: string,
  end: string,
  unit: string,
): number | null {
  if (typeof unit !== "string") {
    return null;
  }

  const resolvedUnit = resolveDateTimeUnit(unit);

  if (!isValidDateTimeUnit(resolvedUnit)) {
    return null;
  }

  if (isLeapSecond(start) || isLeapSecond(end)) {
    return null;
  }

  if (!isValidZonedInterval(start, end)) {
    return null;
  }

  try {
    const startVal = Temporal.ZonedDateTime.from(start);
    const endVal = Temporal.ZonedDateTime.from(end);

    const duration = startVal.until(endVal, { largestUnit: resolvedUnit });

    // total() with relativeTo gives the exact, DST-aware elapsed length, unlike
    // intervalCountZoned's boundary-crossing count — a spring-forward day touches 1 day
    // boundary via intervalCountZoned but is exactly 23/24 days (or 23 hours) here.
    return duration.total({ unit: resolvedUnit, relativeTo: startVal });
  } catch {
    return null;
  }
}
