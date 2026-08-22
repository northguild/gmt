import { Temporal } from "@js-temporal/polyfill";
import { resolveDateTimeUnit } from "../../internal";
import { isValidDateTimeUnit } from "../validate";
import { isValidDateTimeInterval } from "./validate";

/**
 * Return the exact length of a datetime interval in `unit`, as a real (possibly fractional) number.
 *
 * - Distinct from `intervalCountDateTime`, which counts calendar/clock `unit` boundaries
 *   *crossed* rather than measuring exact duration — an interval from 23:59 to 00:01 touches 2
 *   day boundaries via `intervalCountDateTime` but has an exact length of ~0.0014 days via
 *   `intervalLengthDateTime`.
 * - Uses `Temporal.Duration.prototype.total`, which resolves calendar units (month, year)
 *   against the interval's own start so a partial month is expressed as a true fraction rather
 *   than truncated.
 * - Returns `0` for a zero-length interval (`start === end`).
 * - Returns `null` on invalid input (unparseable start/end, `start > end`, unsupported unit).
 *
 * @param start ISO PlainDateTime string for the interval start
 * @param end ISO PlainDateTime string for the interval end
 * @param unit unit string — any `DateTimeUnit`
 * @returns exact length of the interval expressed in `unit`, or null on invalid input
 *
 * @example intervalLengthDateTime("2024-01-01T23:59:00", "2024-01-02T00:01:00", "day") // 0.001388888888888889
 * @example intervalLengthDateTime("2024-01-01T23:59:00", "2024-01-02T00:01:00", "minute") // 2
 * @example intervalLengthDateTime("2024-01-01T00:00:00", "2024-01-01T00:00:00", "day") // 0
 * @example intervalLengthDateTime("invalid", "2024-01-02T00:00:00", "day") // null
 */
export function intervalLengthDateTime(
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

  if (!isValidDateTimeInterval(start, end)) {
    return null;
  }

  try {
    const startVal = Temporal.PlainDateTime.from(start);
    const endVal = Temporal.PlainDateTime.from(end);

    const duration = startVal.until(endVal, { largestUnit: resolvedUnit });

    // total() gives the exact elapsed length, unlike intervalCountDateTime's boundary-crossing
    // count — 23:59 -> 00:01 is 2 day boundaries via intervalCountDateTime but ~0.0014 days here.
    return duration.total({ unit: resolvedUnit, relativeTo: startVal });
  } catch {
    return null;
  }
}
