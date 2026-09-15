import { Temporal } from "@js-temporal/polyfill";
import { closedIntervalsAbut } from "../../internal";
import { plainTime } from "../../regex";

/**
 * Return true when two time intervals are exactly adjacent — one's end is one nanosecond
 * before the other's start, so they share no instant and leave no gap.
 *
 * - Uses `Temporal.PlainTime.compare` for comparison.
 * - Returns `true` when `bStart - 1 nanosecond === aEnd` (with `aEnd < bStart`) or
 *   `aStart - 1 nanosecond === bEnd` (with `bEnd < aStart`).
 * - PlainTime has no day rollover: an interval ending at `23:59:59.999999999` abuts nothing after
 *   it, and never "wraps" to abut one starting at `00:00:00`.
 * - Returns `false` when intervals overlap, are disjoint with a gap, or are invalid.
 * - Returns `false` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 time string for the first interval start
 * @param aEnd ISO 8601 time string for the first interval end
 * @param bStart ISO 8601 time string for the second interval start
 * @param bEnd ISO 8601 time string for the second interval end
 * @returns true if intervals are exactly adjacent, or false on invalid input
 *
 * @example intervalAbutsTime("09:00:00", "12:00:00", "12:00:00.000000001", "17:00:00") // true
 * @example intervalAbutsTime("12:00:00.000000001", "17:00:00", "09:00:00", "12:00:00") // true
 * @example intervalAbutsTime("09:00:00", "12:00:00", "12:00:01", "17:00:00") // false (gap)
 * @example intervalAbutsTime("09:00:00", "13:00:00", "12:00:00", "17:00:00") // false (overlap)
 * @example intervalAbutsTime("22:00:00", "23:59:59.999999999", "00:00:00", "01:00:00") // false (no midnight wrap)
 * @example intervalAbutsTime("invalid", "12:00:00", "12:00:00", "17:00:00") // false
 */
export function intervalAbutsTime(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  if (
    typeof aStart !== "string" ||
    typeof aEnd !== "string" ||
    typeof bStart !== "string" ||
    typeof bEnd !== "string"
  ) {
    return false;
  }

  if (
    !plainTime.test(aStart) ||
    !plainTime.test(aEnd) ||
    !plainTime.test(bStart) ||
    !plainTime.test(bEnd)
  ) {
    return false;
  }

  try {
    const aS = Temporal.PlainTime.from(aStart);
    const aE = Temporal.PlainTime.from(aEnd);
    const bS = Temporal.PlainTime.from(bStart);
    const bE = Temporal.PlainTime.from(bEnd);

    if (Temporal.PlainTime.compare(aS, aE) > 0) {
      return false;
    }

    if (Temporal.PlainTime.compare(bS, bE) > 0) {
      return false;
    }

    return closedIntervalsAbut(
      aS,
      aE,
      bS,
      bE,
      Temporal.PlainTime.compare,
      (value) => value.subtract({ nanoseconds: 1 }),
    );
  } catch {
    return false;
  }
}
