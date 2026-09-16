import { countZonedBuckets } from "../../internal";
import { resolveUnixIntervalPair } from "../../internal/resolveUnixIntervalPair";

/**
 * Count how many `unit` boundaries a Unix epoch interval crosses.
 *
 * - Counts local calendar boundaries touched by the half-open interval `[start, end)` —
 *   distinct from `diffUnix`, which measures exact elapsed duration.
 * - The end boundary is excluded: midnight to midnight two days later counts 2 days.
 * - A zero-length interval counts 1 when it sits mid-unit and 0 when it sits exactly on a
 *   unit boundary.
 * - Reads `start` and `end` as epoch milliseconds; there is no `epochUnit` option.
 * - Uses the system time zone for calendar-unit boundaries (there is no `timeZone` option,
 *   consistent with `intervalLengthUnix` and `splitIntervalByUnitUnix`), so day/week/month/year
 *   counts are host-dependent.
 * - Counts the real local buckets `floorToZone`/`bucketRange` walk in that zone: a bucket
 *   shorter than its unit still counts once (a 15-minute `Pacific/Chatham` hour on its
 *   spring-forward), and a local day the zone deleted counts not at all
 *   (`Pacific/Apia`'s 2011-12-30).
 * - The count equals `bucketRange(...).length` wherever `bucketRange` is within its 10,000-bucket
 *   cap. Counting has its own, separate cap of 10,000 zone transitions, so it keeps answering past
 *   `bucketRange`'s: two years by hour counts 17,544 while `bucketRange` returns `[]`.
 * - Returns `null` when the span crosses more than 10,000 zone transitions.
 * - Weeks start on Monday (ISO 8601).
 * - Accepts singular or plural units (`"day"` and `"days"` behave identically).
 * - Returns `null` on invalid input (`start`/`end` that is not a safe integer or numeric string of
 *   one, or lies outside the Temporal instant range, `start > end`, or an unsupported unit), and
 *   when the system time zone cannot be resolved.
 *
 * @param start Unix epoch milliseconds — interval start
 * @param end Unix epoch milliseconds — interval end
 * @param unit unit string — any `DateTimeUnit`
 * @returns number of unit boundaries touched, or null on invalid input
 *
 * @example intervalCountUnix(0, 86400000, "hour") // 24
 * @example intervalCountUnix(1704153540000, 1704153660000, "day") // 2 (on a UTC host: 23:59 to 00:01 crosses midnight)
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

    return countZonedBuckets(startVal, endVal, resolvedUnit);
  } catch {
    return null;
  }
}
