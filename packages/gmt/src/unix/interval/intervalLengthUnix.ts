import { durationTotal, zonedUntil } from "../../internal";
import { resolveUnixIntervalPair } from "../../internal/resolveUnixIntervalPair";

/**
 * Return the exact length of a Unix epoch interval in `unit`, as a real (possibly fractional) number.
 *
 * - Distinct from `intervalCountUnix`, which counts local calendar `unit` boundaries *crossed*
 *   rather than measuring exact duration.
 * - Reads `start` and `end` as epoch milliseconds; there is no `epochUnit` option.
 * - Uses the system time zone for calendar-unit resolution (there is no `timeZone` option,
 *   consistent with `intervalCountUnix` and `splitIntervalByUnitUnix`), so month/year lengths are
 *   host-dependent; fixed-length units (hour, minute, second, …) are zone-independent.
 * - Returns `0` for a zero-length interval (`start === end`).
 * - Returns `null` on invalid input (`start`/`end` that is not a safe integer or numeric string of
 *   one, or lies outside the Temporal instant range, `start > end`, or an unsupported unit), and
 *   when the system time zone cannot be resolved.
 *
 * @param start Unix epoch milliseconds — interval start
 * @param end Unix epoch milliseconds — interval end
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
    const duration = zonedUntil(startVal, endVal, {
      largestUnit: resolvedUnit,
    });

    // total() gives the exact elapsed length, unlike intervalCountUnix's boundary-crossing
    // count over the same system-timeZone calendar.
    return durationTotal(duration, resolvedUnit, startVal);
  } catch {
    return null;
  }
}
