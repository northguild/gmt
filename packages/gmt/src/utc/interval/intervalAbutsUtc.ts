// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { halfOpenAbuts } from "../../internal";
import { isValidUtc } from "../validate";

/**
 * Return true when two half-open UTC intervals `[aStart, aEnd)` and `[bStart, bEnd)` are exactly
 * adjacent — one ends where the other starts, so they share nothing and leave no gap.
 *
 * - Half-open: an interval holds every `t` with `start <= t < end`, so an interval's `end` is the
 *   first value after it. Returns `true` when `aEnd === bStart` or `bEnd === aStart` (Allen's
 *   "meets"). There is no one-nanosecond step: a one-nanosecond gap is a gap.
 * - An empty interval (`start === end`) abuts nothing.
 * - Uses `Temporal.Instant.compare` for comparison.
 * - Returns `false` when intervals overlap, are disjoint with a gap, or are invalid.
 * - Returns `false` on invalid input (wrong type, malformed strings, leap seconds).
 *
 * @param aStart ISO 8601 UTC datetime string for the first interval start
 * @param aEnd ISO 8601 UTC datetime string for the first interval end
 * @param bStart ISO 8601 UTC datetime string for the second interval start
 * @param bEnd ISO 8601 UTC datetime string for the second interval end
 * @returns true if intervals are exactly adjacent, or false on invalid input
 *
 * @example intervalAbutsUtc("2024-01-01T09:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T17:00:00Z") // true
 * @example intervalAbutsUtc("2024-01-01T12:00:00Z", "2024-01-01T17:00:00Z", "2024-01-01T09:00:00Z", "2024-01-01T12:00:00Z") // true
 * @example intervalAbutsUtc("2024-01-01T09:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T12:00:00.000000001Z", "2024-01-01T17:00:00Z") // false (1 ns gap)
 * @example intervalAbutsUtc("2024-01-01T09:00:00Z", "2024-01-01T13:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T17:00:00Z") // false (overlap)
 * @example intervalAbutsUtc("invalid", "2024-06-30T12:00:00Z", "2024-06-30T12:00:00Z", "2024-12-31T17:00:00Z") // false
 */
export function intervalAbutsUtc(
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
    !isValidUtc(aStart) ||
    !isValidUtc(aEnd) ||
    !isValidUtc(bStart) ||
    !isValidUtc(bEnd)
  ) {
    return false;
  }

  try {
    const aS = Temporal.Instant.from(aStart);
    const aE = Temporal.Instant.from(aEnd);
    const bS = Temporal.Instant.from(bStart);
    const bE = Temporal.Instant.from(bEnd);

    if (Temporal.Instant.compare(aS, aE) > 0) {
      return false;
    }

    if (Temporal.Instant.compare(bS, bE) > 0) {
      return false;
    }

    return halfOpenAbuts(
      { start: aS, end: aE },
      { start: bS, end: bE },
      Temporal.Instant.compare,
    );
  } catch {
    return false;
  }
}
