// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { halfOpenAbuts } from "../../internal";
import { isValidTime } from "../validate";

/**
 * Return true when two half-open time intervals `[aStart, aEnd)` and `[bStart, bEnd)` are exactly
 * adjacent — one ends where the other starts, so they share nothing and leave no gap.
 *
 * - Half-open: an interval holds every `t` with `start <= t < end`, so an interval's `end` is the
 *   first value after it. Returns `true` when `aEnd === bStart` or `bEnd === aStart` (Allen's
 *   "meets"). There is no one-nanosecond step: a one-nanosecond gap is a gap.
 * - An empty interval (`start === end`) abuts nothing.
 * - PlainTime has no day rollover: an interval ending at `23:59:59.999999999` never abuts one
 *   starting at `00:00:00`.
 * - Uses `Temporal.PlainTime.compare` for comparison.
 * - Returns `false` when intervals overlap, are disjoint with a gap, or are invalid.
 * - Returns `false` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 time string for the first interval start
 * @param aEnd ISO 8601 time string for the first interval end
 * @param bStart ISO 8601 time string for the second interval start
 * @param bEnd ISO 8601 time string for the second interval end
 * @returns true if intervals are exactly adjacent, or false on invalid input
 *
 * @example intervalAbutsTime("09:00:00", "12:00:00", "12:00:00", "17:00:00") // true
 * @example intervalAbutsTime("12:00:00", "17:00:00", "09:00:00", "12:00:00") // true
 * @example intervalAbutsTime("09:00:00", "12:00:00", "12:00:00.000000001", "17:00:00") // false (1 ns gap)
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

    return halfOpenAbuts(
      { start: aS, end: aE },
      { start: bS, end: bE },
      Temporal.PlainTime.compare,
    );
  } catch {
    return false;
  }
}
