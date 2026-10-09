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
 * - `start` and `end` are each a safe integer or a string of optionally negative ASCII digits.
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
 * - **Limit at an offset with seconds.** The instant is placed in the offset's whole-minute zone,
 *   moved by its seconds, and the moved instant must be inside Temporal's range. So within the
 *   offset's seconds (under a minute) of the last instant Temporal supports
 *   (`+275760-09-13T00:00:00Z`) for an offset east of UTC, or of the first
 *   (`-271821-04-20T00:00:00Z`) for one west, this returns `null`. An offset to the minute has no
 *   such limit.
 *
 * @param start Unix epoch in `epochUnit` — interval start
 * @param end Unix epoch in `epochUnit` — interval end
 * @param unit unit string — any `DateTimeUnit`, singular or plural
 * @param options optional: how the epochs are read and the zone the boundaries are found in
 * @returns number of unit boundaries touched, or null on invalid input
 *
 * @example intervalCountUnix(0, 86400000, "hour") // 24
 * @example intervalCountUnix(1704153540000, 1704153660000, "day") // 2 (23:59 to 00:01 UTC crosses midnight)
 * @example intervalCountUnix(1800000, 1800000, "hour") // 0 (zero-length: holds no instant)
 * @example intervalCountUnix(86400000, 0, "hour") // null
 * @example intervalCountUnix(1704151800000, 1704155400000, "day", { timeZone: "Asia/Tokyo" }) // 1 (08:30 to 09:30 on one Tokyo day)
 * @example intervalCountUnix("1704151800", "1704155400", "days", { epochUnit: "second" }) // 2
 * @example intervalCountUnix(NaN, 86400000, "hour") // null
 * @example intervalCountUnix(2669999, 2670001, "day", { timeZone: "-00:44:30" }) // 2 (the local day turns at 00:44:30Z)
 */
export function intervalCountUnix(
  start: number | string,
  end: number | string,
  unit: string,
  options?: {
    /**
     * The unit the epoch values are counted in: `"seconds"` or `"milliseconds"`, singular or
     * plural. Any other value returns `null`.
     *
     * @defaultValue `"milliseconds"`
     */
    epochUnit?: UnixUnit;
    /**
     * The time zone the unit boundaries are found in: an IANA name, a UTC offset (a time zone
     * identifier such as `+05:30`, `+0530` or `-08`, or a stored offset `±HH:MM[:SS]`, what
     * `getTimeZoneOffset` returns), or `"local"` for the system time zone. An unknown zone returns
     * `null`.
     *
     * @defaultValue `"UTC"`
     */
    timeZone?: string;
  },
): number | null {
  try {
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
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
