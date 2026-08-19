import { Temporal } from "@js-temporal/polyfill";
import {
  getStartOfZonedUnit,
  getUnitSpan,
  resolveDateTimeUnit,
} from "../../internal";
import { isValidDateTimeUnit } from "../../plain/validate";
import { getSystemTimeZone } from "../../zoned/get";
import { isValidTimeZone } from "../../zoned/validate";

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
  if (typeof start !== "number" && typeof start !== "string") {
    return null;
  }

  if (typeof end !== "number" && typeof end !== "string") {
    return null;
  }

  const startMs = typeof start === "number" ? start : Number(start);
  const endMs = typeof end === "number" ? end : Number(end);

  if (!Number.isFinite(startMs) || !Number.isInteger(startMs)) {
    return null;
  }

  if (!Number.isFinite(endMs) || !Number.isInteger(endMs)) {
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
    const timeZone = getSystemTimeZone();

    if (!timeZone || !isValidTimeZone(timeZone)) {
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
