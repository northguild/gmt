import { Temporal } from "@js-temporal/polyfill";
import { resolveDateTimeUnit } from "../../internal";
import { isValidDateTimeUnit } from "../../plain/validate";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { isValidUtcInterval } from "./validate";

/**
 * Return the exact length of a UTC interval in `unit`, as a real (possibly fractional) number.
 *
 * - Distinct from `intervalCountUtc`, which counts calendar `unit` boundaries *crossed* rather
 *   than measuring exact duration — an interval from 23:59 to 00:01 touches 2 day boundaries
 *   via `intervalCountUtc` but has an exact length of ~0.0014 days via `intervalLengthUtc`.
 * - Boundaries are UTC boundaries — no DST is involved.
 * - Returns `0` for a zero-length interval (`start === end`).
 * - Returns `null` on invalid input (unparseable start/end, `start > end`, unsupported unit,
 *   leap-second strings).
 *
 * @param start ISO UTC datetime string for the interval start
 * @param end ISO UTC datetime string for the interval end
 * @param unit unit string — any `DateTimeUnit`
 * @returns exact length of the interval expressed in `unit`, or null on invalid input
 *
 * @example intervalLengthUtc("2024-01-01T23:59:00Z", "2024-01-02T00:01:00Z", "day") // 0.001388888888888889
 * @example intervalLengthUtc("2024-01-01T23:59:00Z", "2024-01-02T00:01:00Z", "minute") // 2
 * @example intervalLengthUtc("2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z", "day") // 0
 * @example intervalLengthUtc("invalid", "2024-01-02T00:00:00Z", "day") // null
 */
export function intervalLengthUtc(
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

  if (!isValidUtcInterval(start, end)) {
    return null;
  }

  try {
    const startVal = Temporal.Instant.from(start).toZonedDateTimeISO("UTC");
    const endVal = Temporal.Instant.from(end).toZonedDateTimeISO("UTC");

    const duration = startVal.until(endVal, { largestUnit: resolvedUnit });

    // total() gives the exact elapsed length, unlike intervalCountUtc's boundary-crossing
    // count — 23:59 -> 00:01 is 2 day boundaries via intervalCountUtc but ~0.0014 days here.
    return duration.total({ unit: resolvedUnit, relativeTo: startVal });
  } catch {
    return null;
  }
}
