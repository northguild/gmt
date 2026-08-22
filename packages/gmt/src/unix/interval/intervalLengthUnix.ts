import { Temporal } from "@js-temporal/polyfill";
import { resolveDateTimeUnit } from "../../internal";
import {
  isValidUnixEpochPair,
  resolveUnixTimeZone,
} from "../../internal/resolveUnixTimeZone";
import { isValidDateTimeUnit } from "../../plain/validate";

/**
 * Return the exact length of a Unix epoch interval in `unit`, as a real (possibly fractional) number.
 *
 * - Distinct from `intervalCountUnix`, which counts local calendar `unit` boundaries *crossed*
 *   rather than measuring exact duration.
 * - Uses the system timeZone for calendar-unit resolution (consistent with `intervalCountUnix`
 *   and `splitIntervalByUnitUnix`), so month/year lengths are host-dependent; fixed-length units
 *   (hour, minute, second, …) are timeZone-independent.
 * - Returns `0` for a zero-length interval (`start === end`).
 * - Returns `null` on invalid input (non-finite/non-integer start/end, `start > end`,
 *   unsupported unit, or invalid timeZone).
 *
 * @param start Unix epoch value (seconds or milliseconds) — interval start
 * @param end Unix epoch value (seconds or milliseconds) — interval end
 * @param unit unit string — any `DateTimeUnit`
 * @returns exact length of the interval expressed in `unit`, or null on invalid input
 *
 * @example intervalLengthUnix(0, 86400000, "hour") // 24
 * @example intervalLengthUnix(0, 5400000, "hour") // 1.5
 * @example intervalLengthUnix(0, 0, "hour") // 0
 * @example intervalLengthUnix(86400000, 0, "hour") // null
 * @example intervalLengthUnix(NaN, 86400000, "hour") // null
 */
export function intervalLengthUnix(
  start: number | string,
  end: number | string,
  unit: string,
): number | null {
  if (typeof start !== "number" && typeof start !== "string") {
    return null;
  }

  if (typeof end !== "number" && typeof end !== "string") {
    return null;
  }

  const startMs = typeof start === "number" ? start : Number(start);
  const endMs = typeof end === "number" ? end : Number(end);

  if (!isValidUnixEpochPair(startMs, endMs)) {
    return null;
  }

  if (startMs > endMs) {
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
    const timeZone = resolveUnixTimeZone();

    if (!timeZone) {
      return null;
    }

    const startVal =
      Temporal.Instant.fromEpochMilliseconds(startMs).toZonedDateTimeISO(
        timeZone,
      );
    const endVal =
      Temporal.Instant.fromEpochMilliseconds(endMs).toZonedDateTimeISO(
        timeZone,
      );

    const duration = startVal.until(endVal, { largestUnit: resolvedUnit });

    // total() gives the exact elapsed length, unlike intervalCountUnix's boundary-crossing
    // count over the same system-timeZone calendar.
    return duration.total({ unit: resolvedUnit, relativeTo: startVal });
  } catch {
    return null;
  }
}
