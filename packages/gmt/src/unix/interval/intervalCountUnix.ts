// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { countZonedBuckets } from "../../internal";
import { resolveUnixIntervalPair } from "../../internal/resolveUnixIntervalPair";
import type { UnixUnit } from "../validate/isValidUnixUnit";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Count how many `unit` boundaries a Unix epoch interval crosses.
 *
 * - Counts local calendar boundaries touched by the half-open interval `[start, end)` —
 *   distinct from `diffUnix`, which measures exact elapsed duration.
 * - The end boundary is excluded: midnight to midnight two days later counts 2 days.
 * - A zero-length interval (`start === end`) returns `0`: the empty `[start, start)` holds no instant,
 *   so it touches no unit (before 1.16.0 it counted 1 when mid-unit).
 * - Reads `start` and `end` in `options.epochUnit` (`"milliseconds"` by default, `"seconds"`; singular
 *   accepted). Each is a safe integer or a string of optionally negative ASCII digits.
 * - Uses `options.timeZone` for calendar-unit boundaries: omitted is `"UTC"`, `"local"` is the
 *   system zone, and an unknown zone returns `null`.
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
 *   one, or lies outside the Temporal instant range, `start > end`, an unsupported unit, an invalid
 *   `epochUnit` or an unknown `timeZone`).
 *
 * @param start Unix epoch in `epochUnit` — interval start
 * @param end Unix epoch in `epochUnit` — interval end
 * @param unit unit string — any `DateTimeUnit`, singular or plural
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC")
 * @returns number of unit boundaries touched, or null on invalid input
 *
 * @example intervalCountUnix(0, 86400000, "hour") // 24
 * @example intervalCountUnix(1704153540000, 1704153660000, "day") // 2 (23:59 to 00:01 UTC crosses midnight)
 * @example intervalCountUnix(1800000, 1800000, "hour") // 0 (zero-length: holds no instant)
 * @example intervalCountUnix(86400000, 0, "hour") // null
 * @example intervalCountUnix(1704151800000, 1704155400000, "day", { timeZone: "Asia/Tokyo" }) // 1 (08:30 to 09:30 on one Tokyo day)
 * @example intervalCountUnix("1704151800", "1704155400", "days", { epochUnit: "second" }) // 2
 * @example intervalCountUnix(NaN, 86400000, "hour") // null
 */
export function intervalCountUnix(
  start: number | string,
  end: number | string,
  unit: string,
  options?: { epochUnit?: UnixUnit; timeZone?: string },
): number | null {
  if (!isOptionsArgument(options)) {
    return null;
  }

  const resolved = resolveUnixIntervalPair(start, end, unit, options);
  if (!resolved) return null;

  try {
    const { startVal, endVal, resolvedUnit } = resolved;

    // An empty interval [t, t) holds no instant, so it touches no unit (CORE-6 empty-interval rule).
    if (startVal.epochNanoseconds === endVal.epochNanoseconds) {
      return 0;
    }

    return countZonedBuckets(startVal, endVal, resolvedUnit);
  } catch {
    return null;
  }
}
