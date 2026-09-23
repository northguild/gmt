// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { halfOpenOverlap } from "../../internal";
import { isValidTime } from "../validate";

/**
 * Return true when the half-open time intervals `[aStart, aEnd)` and `[bStart, bEnd)` share at
 * least one clock time.
 *
 * - Half-open: an interval holds every `t` with `start <= t < end`, so `end` itself is not in it
 *   (the rule CORE-6's `intervalsOverlap` uses). The test is `aStart < bEnd && bStart < aEnd`.
 * - Touching intervals (`aEnd` equal to `bStart`) share no time and do not overlap.
 * - An empty interval (`start === end`) overlaps only an interval it lies strictly inside.
 * - PlainTime has no day rollover: an interval never wraps past midnight.
 * - Uses `Temporal.PlainTime.compare` for comparison.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 time string for the first interval start
 * @param aEnd ISO 8601 time string for the first interval end (excluded)
 * @param bStart ISO 8601 time string for the second interval start
 * @param bEnd ISO 8601 time string for the second interval end (excluded)
 * @returns true if intervals overlap, or false on invalid input
 *
 * @example intervalsOverlapTime("09:00:00", "17:00:00", "12:00:00", "18:00:00") // true
 * @example intervalsOverlapTime("09:00:00", "17:00:00", "17:00:00", "18:00:00") // false (touching)
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
    !isValidTime(aStart) ||
    !isValidTime(aEnd) ||
    !isValidTime(bStart) ||
    !isValidTime(bEnd)
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

    return halfOpenOverlap(
      { start: aS, end: aE },
      { start: bS, end: bE },
      Temporal.PlainTime.compare,
    );
  } catch {
    return false;
  }
}
