import { Temporal } from "@js-temporal/polyfill";
import { getUnitSpan, resolveDateTimeUnit } from "../../internal";
import { plainTime } from "../../regex";
import { isValidTime, isValidTimeUnit } from "../validate";

/**
 * Count how many `unit` boundaries a time interval crosses.
 *
 * - Counts clock boundaries touched by the half-open interval `[start, end)` — distinct from
 *   `diffTime`, which measures exact elapsed duration. An interval from 12:59 to 13:01 is two
 *   minutes long but touches 2 hour boundaries.
 * - The end boundary is excluded: `"12:00:00"` to `"14:00:00"` counts 2 hours.
 * - A zero-length interval counts 1 when it sits mid-unit and 0 when it sits exactly on a
 *   unit boundary.
 * - Accepts singular or plural units (`"hour"` and `"hours"` behave identically).
 * - Returns `null` on invalid input (unparseable start/end, `start > end`, unsupported unit,
 *   or a unit that has no effect on `PlainTime`, e.g. `"days"`).
 *
 * @param start ISO PlainTime string for the interval start
 * @param end ISO PlainTime string for the interval end
 * @param unit unit string — `"hour" | "minute" | "second" | "millisecond" | "microsecond" | "nanosecond"` (calendar units return null)
 * @returns number of unit boundaries touched, or null on invalid input
 *
 * @example intervalCountTime("12:00:00", "14:00:00", "hour") // 2
 * @example intervalCountTime("12:30:00", "13:00:00", "hour") // 1
 * @example intervalCountTime("12:30:00", "12:30:00", "hour") // 1 (zero-length, mid-hour)
 * @example intervalCountTime("12:00:00", "12:00:00", "hour") // 0 (zero-length, on the boundary)
 * @example intervalCountTime("12:00:00", "14:00:00", "day") // null
 * @example intervalCountTime("invalid", "14:00:00", "hour") // null
 */
export function intervalCountTime(
  start: string,
  end: string,
  unit: string,
): number | null {
  if (typeof start !== "string" || typeof end !== "string") {
    return null;
  }

  if (!plainTime.test(start) || !plainTime.test(end)) {
    return null;
  }

  if (!isValidTime(start) || !isValidTime(end)) {
    return null;
  }

  if (typeof unit !== "string") {
    return null;
  }

  const resolvedUnit = resolveDateTimeUnit(unit);

  if (!isValidTimeUnit(resolvedUnit)) {
    return null;
  }

  try {
    const startVal = Temporal.PlainTime.from(start);
    const endVal = Temporal.PlainTime.from(end);

    if (Temporal.PlainTime.compare(startVal, endVal) > 0) {
      return null;
    }

    const startOfStart = startVal.round({
      smallestUnit: resolvedUnit,
      roundingMode: "trunc",
    });
    const startOfEnd = endVal.round({
      smallestUnit: resolvedUnit,
      roundingMode: "trunc",
    });

    const spanned = getUnitSpan(
      startOfStart.until(startOfEnd, { largestUnit: resolvedUnit }),
      resolvedUnit,
    );

    return spanned + (startOfEnd.equals(endVal) ? 0 : 1);
  } catch {
    return null;
  }
}
