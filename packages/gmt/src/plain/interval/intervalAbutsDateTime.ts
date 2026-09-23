// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { halfOpenAbuts } from "../../internal";
import { isValidDateTime } from "../validate";

/**
 * Return true when two half-open datetime intervals `[aStart, aEnd)` and `[bStart, bEnd)` are exactly
 * adjacent — one ends where the other starts, so they share nothing and leave no gap.
 *
 * - Half-open: an interval holds every `t` with `start <= t < end`, so an interval's `end` is the
 *   first value after it. Returns `true` when `aEnd === bStart` or `bEnd === aStart` (Allen's
 *   "meets"). There is no one-nanosecond step: a one-nanosecond gap is a gap.
 * - An empty interval (`start === end`) abuts nothing.
 * - Uses `Temporal.PlainDateTime.compare` for comparison.
 * - Returns `false` when intervals overlap, are disjoint with a gap, or are invalid.
 * - Returns `false` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 datetime string for the first interval start
 * @param aEnd ISO 8601 datetime string for the first interval end
 * @param bStart ISO 8601 datetime string for the second interval start
 * @param bEnd ISO 8601 datetime string for the second interval end
 * @returns true if intervals are exactly adjacent, or false on invalid input
 *
 * @example intervalAbutsDateTime("2024-01-01T09:00:00", "2024-01-01T12:00:00", "2024-01-01T12:00:00", "2024-01-01T17:00:00") // true
 * @example intervalAbutsDateTime("2024-01-01T09:00:00", "2024-01-01T12:00:00", "2024-01-01T12:00:00.000000001", "2024-01-01T17:00:00") // false (1 ns gap)
 * @example intervalAbutsDateTime("2024-01-01T09:00:00", "2024-01-01T13:00:00", "2024-01-01T12:00:00", "2024-01-01T17:00:00") // false (overlap)
 * @example intervalAbutsDateTime("invalid", "2024-06-30T12:00:00", "2024-06-30T12:00:00", "2024-12-31T17:00:00") // false
 */
export function intervalAbutsDateTime(
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
    !isValidDateTime(aStart) ||
    !isValidDateTime(aEnd) ||
    !isValidDateTime(bStart) ||
    !isValidDateTime(bEnd)
  ) {
    return false;
  }

  try {
    const aS = Temporal.PlainDateTime.from(aStart);
    const aE = Temporal.PlainDateTime.from(aEnd);
    const bS = Temporal.PlainDateTime.from(bStart);
    const bE = Temporal.PlainDateTime.from(bEnd);

    if (Temporal.PlainDateTime.compare(aS, aE) > 0) {
      return false;
    }

    if (Temporal.PlainDateTime.compare(bS, bE) > 0) {
      return false;
    }

    return halfOpenAbuts(
      { start: aS, end: aE },
      { start: bS, end: bE },
      Temporal.PlainDateTime.compare,
    );
  } catch {
    return false;
  }
}
