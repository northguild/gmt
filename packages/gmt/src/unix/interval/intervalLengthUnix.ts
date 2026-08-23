import { resolveUnixIntervalPair } from "./resolveUnixIntervalPair";

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
  const resolved = resolveUnixIntervalPair(start, end, unit);

  if (!resolved) return null;

  try {
    const { startVal, endVal, resolvedUnit } = resolved;
    const duration = startVal.until(endVal, { largestUnit: resolvedUnit });

    // total() gives the exact elapsed length, unlike intervalCountUnix's boundary-crossing
    // count over the same system-timeZone calendar.
    return duration.total({ unit: resolvedUnit, relativeTo: startVal });
  } catch {
    return null;
  }
}
