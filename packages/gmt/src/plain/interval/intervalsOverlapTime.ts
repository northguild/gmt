import { Temporal } from "@js-temporal/polyfill";
import { plainTime } from "../../regex";

/**
 * Return true when intervals `[aStart, aEnd]` and `[bStart, bEnd]` share at least one instant.
 *
 * - Uses `Temporal.PlainTime.compare` for comparison.
 * - Adjacent intervals (e.g. `aEnd === bStart`) do NOT overlap — returns `false`.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 time string for the first interval start
 * @param aEnd ISO 8601 time string for the first interval end
 * @param bStart ISO 8601 time string for the second interval start
 * @param bEnd ISO 8601 time string for the second interval end
 * @returns true if intervals overlap, or false on invalid input
 *
 * @example intervalsOverlapTime("09:00:00", "17:00:00", "12:00:00", "18:00:00") // true
 * @example intervalsOverlapTime("09:00:00", "17:00:00", "17:00:00", "18:00:00") // false (adjacent)
 * @example intervalsOverlapTime("09:00:00", "17:00:00", "18:00:00", "20:00:00") // false (disjoint)
 * @example intervalsOverlapTime("09:00:00", "17:00:00", "10:00:00", "11:00:00") // true (contained)
 * @example intervalsOverlapTime("invalid", "17:00:00", "12:00:00", "18:00:00") // false
 */
export function intervalsOverlapTime(
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

    return (
      Temporal.PlainTime.compare(aE, bS) >= 0 &&
      Temporal.PlainTime.compare(bE, aS) >= 0
    );
  } catch {
    return false;
  }
}
