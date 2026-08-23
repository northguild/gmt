import { getStartOfZonedUnit, getUnitSpan } from "../../internal";
import { resolveUnixIntervalPair } from "./resolveUnixIntervalPair";

/**
 * Count how many `unit` boundaries a Unix epoch interval crosses.
 *
 * - Counts local calendar boundaries touched by the half-open interval `[start, end)` —
 *   distinct from `diffUnix`, which measures exact elapsed duration.
 * - The end boundary is excluded: midnight to midnight two days later counts 2 days.
 * - A zero-length interval counts 1 when it sits mid-unit and 0 when it sits exactly on a
 *   unit boundary.
 * - Uses the system timeZone for calendar-unit boundaries (consistent with `addUnix` and
 *   `splitIntervalByUnitUnix`), so day/week/month/year counts are host-dependent.
 * - Weeks start on Monday (ISO 8601).
 * - Accepts singular or plural units (`"day"` and `"days"` behave identically).
 * - Returns `null` on invalid input (non-finite/non-integer start/end, `start > end`,
 *   unsupported unit, or invalid timeZone).
 *
 * @param start Unix epoch value (seconds or milliseconds) — interval start
 * @param end Unix epoch value (seconds or milliseconds) — interval end
 * @param unit unit string — any `DateTimeUnit`
 * @returns number of unit boundaries touched, or null on invalid input
 *
 * @example intervalCountUnix(0, 86400000, "hour") // 24
 * @example intervalCountUnix(1704153540000, 1704153660000, "day") // 2 (23:59 to 00:01 UTC)
 * @example intervalCountUnix(0, 0, "hour") // 0 (zero-length, on the boundary)
 * @example intervalCountUnix(1800000, 1800000, "hour") // 1 (zero-length, mid-hour)
 * @example intervalCountUnix(86400000, 0, "hour") // null
 * @example intervalCountUnix(NaN, 86400000, "hour") // null
 */
export function intervalCountUnix(
  start: number | string,
  end: number | string,
  unit: string,
): number | null {
  const resolved = resolveUnixIntervalPair(start, end, unit);
  if (!resolved) return null;

  try {
    const { startVal, endVal, resolvedUnit } = resolved;
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
