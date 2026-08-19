import { Temporal } from "@js-temporal/polyfill";
import {
  getStartOfZonedUnit,
  getUnitSpan,
  resolveDateTimeUnit,
} from "../../internal";
import { isValidDateTimeUnit } from "../../plain/validate";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { utcDateTime } from "../../regex/utc-date-time";
import { isValidUtc } from "../validate/isValidUtc";

/**
 * Count how many `unit` boundaries a UTC interval crosses.
 *
 * - Counts calendar boundaries touched by the half-open interval `[start, end)` — distinct
 *   from `diffUtc`, which measures exact elapsed duration. An interval from 23:59 to 00:01 is
 *   two minutes long but touches 2 day boundaries.
 * - The end boundary is excluded: midnight to midnight two days later counts 2 days.
 * - A zero-length interval counts 1 when it sits mid-unit and 0 when it sits exactly on a
 *   unit boundary.
 * - Boundaries are UTC boundaries — no DST is involved.
 * - Weeks start on Monday (ISO 8601).
 * - Accepts singular or plural units (`"day"` and `"days"` behave identically).
 * - Returns `null` on invalid input (unparseable start/end, `start > end`, unsupported unit,
 *   leap-second strings).
 *
 * @param start ISO UTC datetime string for the interval start
 * @param end ISO UTC datetime string for the interval end
 * @param unit unit string — any `DateTimeUnit`
 * @returns number of unit boundaries touched, or null on invalid input
 *
 * @example intervalCountUtc("2024-01-01T23:59:00Z", "2024-01-02T00:01:00Z", "day") // 2
 * @example intervalCountUtc("2024-01-01T00:00:00Z", "2024-01-03T00:00:00Z", "day") // 2
 * @example intervalCountUtc("2024-01-15T00:00:00Z", "2024-03-10T00:00:00Z", "month") // 3
 * @example intervalCountUtc("2024-01-01T05:00:00Z", "2024-01-01T05:00:00Z", "day") // 1 (zero-length, mid-day)
 * @example intervalCountUtc("2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z", "day") // 0 (zero-length, on the boundary)
 * @example intervalCountUtc("invalid", "2024-01-02T00:00:00Z", "day") // null
 */
export function intervalCountUtc(
  start: string,
  end: string,
  unit: string,
): number | null {
  if (typeof start !== "string" || typeof end !== "string") {
    return null;
  }

  if (!utcDateTime.test(start) || !utcDateTime.test(end)) {
    return null;
  }

  if (isLeapSecond(start) || isLeapSecond(end)) {
    return null;
  }

  if (!isValidUtc(start) || !isValidUtc(end)) {
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
    const startVal = Temporal.Instant.from(start).toZonedDateTimeISO("UTC");
    const endVal = Temporal.Instant.from(end).toZonedDateTimeISO("UTC");

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
