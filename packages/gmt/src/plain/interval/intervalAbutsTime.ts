import { Temporal } from "@js-temporal/polyfill";
import { plainTime } from "../../regex";

/**
 * Return true when two time intervals are exactly adjacent — one's end equals the other's start
 * with zero gap and zero overlap.
 *
 * - Uses `Temporal.PlainTime.compare` for comparison.
 * - Returns `true` when `aEnd + 1 nanosecond === bStart` or `bEnd + 1 nanosecond === aStart`.
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
 * @example intervalAbutsTime("12:00:00", "17:00:00", "09:00:00", "12:00:00") // true
 * @example intervalAbutsTime("09:00:00", "12:00:00", "12:00:01", "17:00:00") // false (gap)
 * @example intervalAbutsTime("09:00:00", "13:00:00", "12:00:00", "17:00:00") // false (overlap)
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

    // aEnd + 1 nanosecond === bStart
    const aEndPlusOne = aE.add({ nanoseconds: 1 });
    if (Temporal.PlainTime.compare(aEndPlusOne, bS) === 0) {
      return true;
    }

    // bEnd + 1 nanosecond === aStart
    const bEndPlusOne = bE.add({ nanoseconds: 1 });
    if (Temporal.PlainTime.compare(bEndPlusOne, aS) === 0) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
