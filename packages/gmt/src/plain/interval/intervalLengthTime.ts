import { Temporal } from "@js-temporal/polyfill";
import { resolveDateTimeUnit } from "../../internal";
import { isValidTimeUnit } from "../validate";
import { isValidTimeInterval } from "./validate";

/**
 * Return the exact length of a time interval in `unit`, as a real (possibly fractional) number.
 *
 * - Distinct from `intervalCountTime`, which counts clock `unit` boundaries *crossed* rather
 *   than measuring exact duration — an interval from 12:59 to 13:01 touches 2 hour boundaries
 *   via `intervalCountTime` but has an exact length of ~0.033 hours via `intervalLengthTime`.
 * - Time units are fixed-length, so no `relativeTo` is needed for the total.
 * - Returns `0` for a zero-length interval (`start === end`).
 * - Returns `null` on invalid input (unparseable start/end, `start > end`, unsupported unit,
 *   or a unit that has no effect on `PlainTime`, e.g. `"days"`).
 *
 * @param start ISO PlainTime string for the interval start
 * @param end ISO PlainTime string for the interval end
 * @param unit unit string — `"hour" | "minute" | "second" | "millisecond" | "microsecond" | "nanosecond"` (calendar units return null)
 * @returns exact length of the interval expressed in `unit`, or null on invalid input
 *
 * @example intervalLengthTime("12:00:00", "14:30:00", "hour") // 2.5
 * @example intervalLengthTime("12:59:00", "13:01:00", "hour") // 0.03333333333333333
 * @example intervalLengthTime("12:00:00", "12:00:00", "hour") // 0
 * @example intervalLengthTime("12:00:00", "14:00:00", "day") // null
 * @example intervalLengthTime("invalid", "14:00:00", "hour") // null
 */
export function intervalLengthTime(
  start: string,
  end: string,
  unit: string,
): number | null {
  if (typeof unit !== "string") {
    return null;
  }

  const resolvedUnit = resolveDateTimeUnit(unit);

  if (!isValidTimeUnit(resolvedUnit)) {
    return null;
  }

  if (!isValidTimeInterval(start, end)) {
    return null;
  }

  try {
    const startVal = Temporal.PlainTime.from(start);
    const endVal = Temporal.PlainTime.from(end);

    const duration = startVal.until(endVal, { largestUnit: resolvedUnit });

    // total() gives the exact elapsed length, unlike intervalCountTime's boundary-crossing
    // count — 12:59 -> 13:01 is 2 hour boundaries via intervalCountTime but ~0.033 hours here.
    return duration.total(resolvedUnit);
  } catch {
    return null;
  }
}
