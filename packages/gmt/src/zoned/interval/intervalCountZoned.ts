import { Temporal } from "@js-temporal/polyfill";
import {
  getStartOfZonedUnit,
  getUnitSpan,
  resolveDateTimeUnit,
} from "../../internal";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { isValidDateTimeUnit } from "../../plain/validate";
import { isValidZonedDateTime } from "../validate/isValidZonedDateTime";

/**
 * Count how many `unit` boundaries a zoned interval crosses.
 *
 * - Counts local calendar boundaries touched by the half-open interval `[start, end)` —
 *   distinct from `diffZoned`, which measures exact elapsed duration.
 * - The end boundary is excluded: midnight to midnight two days later counts 2 days.
 * - A zero-length interval counts 1 when it sits mid-unit and 0 when it sits exactly on a
 *   unit boundary.
 * - DST-aware: a local day that springs forward counts 23 hour boundaries and one that falls
 *   back counts 25. A local day whose midnight is skipped entirely starts at 01:00.
 * - A fixed 24-hour span touches 25 local hour boundaries in zones offset by :30/:45.
 * - When `start` and `end` carry different time zones, boundaries are counted in `start`'s zone.
 * - Weeks start on Monday (ISO 8601).
 * - Accepts singular or plural units (`"day"` and `"days"` behave identically).
 * - Returns `null` on invalid input (unparseable start/end, `start > end`, unsupported unit,
 *   leap-second strings).
 *
 * @param start ISO 8601 zoned datetime string for the interval start
 * @param end ISO 8601 zoned datetime string for the interval end
 * @param unit unit string — any `DateTimeUnit`
 * @returns number of unit boundaries touched, or null on invalid input
 *
 * @example intervalCountZoned("2024-01-01T23:59:00+00:00[UTC]", "2024-01-02T00:01:00+00:00[UTC]", "day") // 2
 * @example intervalCountZoned("2024-03-10T00:00:00-05:00[America/New_York]", "2024-03-11T00:00:00-04:00[America/New_York]", "hour") // 23 (spring forward)
 * @example intervalCountZoned("2024-11-03T00:00:00-04:00[America/New_York]", "2024-11-04T00:00:00-05:00[America/New_York]", "hour") // 25 (fall back)
 * @example intervalCountZoned("2024-01-01T00:00:00-05:00[America/New_York]", "2024-01-03T00:00:00+09:00[Asia/Tokyo]", "day") // 2 (counted in America/New_York)
 * @example intervalCountZoned("2024-01-01T05:00:00+00:00[UTC]", "2024-01-01T05:00:00+00:00[UTC]", "day") // 1 (zero-length, mid-day)
 * @example intervalCountZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-01T00:00:00+00:00[UTC]", "day") // 0 (zero-length, on the boundary)
 * @example intervalCountZoned("invalid", "2024-01-02T00:00:00+00:00[UTC]", "day") // null
 */
export function intervalCountZoned(
  start: string,
  end: string,
  unit: string,
): number | null {
  if (typeof start !== "string" || typeof end !== "string") {
    return null;
  }

  if (isLeapSecond(start) || isLeapSecond(end)) {
    return null;
  }

  if (!isValidZonedDateTime(start) || !isValidZonedDateTime(end)) {
    return null;
  }

  if (typeof unit !== "string") {
    return null;
  }

  const resolvedUnit = resolveDateTimeUnit(unit);

  if (!isValidDateTimeUnit(resolvedUnit)) {
    return null;
  }

  try {
    const startVal = Temporal.ZonedDateTime.from(start);
    // Boundaries are counted in the start's zone, so the end is re-expressed there.
    // Temporal refuses calendar-unit differences across two zones outright.
    const endVal = Temporal.ZonedDateTime.from(end).withTimeZone(
      startVal.timeZoneId,
    );

    if (Temporal.ZonedDateTime.compare(startVal, endVal) > 0) {
      return null;
    }

    const startOfStart = getStartOfZonedUnit(startVal, resolvedUnit);
    const startOfEnd = getStartOfZonedUnit(endVal, resolvedUnit);

    const spanned = getUnitSpan(
      startOfStart.until(startOfEnd, { largestUnit: resolvedUnit }),
      resolvedUnit,
    );

    return spanned + (startOfEnd.equals(endVal) ? 0 : 1);
  } catch {
    return null;
  }
}
