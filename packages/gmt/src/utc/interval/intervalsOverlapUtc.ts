// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { intervalsOverlap } from "../../interval/compare";
import { isValidUtc } from "../validate";

/**
 * Return true when the half-open UTC intervals `[aStart, aEnd)` and `[bStart, bEnd)` share at
 * least one instant.
 *
 * - Half-open: an interval holds every instant `t` with `start <= t < end`, so `end` itself is not
 *   in it. The test is `aStart < bEnd && bStart < aEnd`.
 * - Delegates to CORE-6's `intervalsOverlap` once the arguments pass the UTC-string gate, so the
 *   answer always equals `intervalsOverlap({ start: aStart, end: aEnd }, { start: bStart, end: bEnd })`.
 * - Touching intervals (`aEnd` equal to `bStart`) share no instant and do not overlap.
 * - An empty interval (`start === end`) overlaps only an interval it lies strictly inside.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input (wrong type, non-`Z` strings, malformed strings, leap seconds).
 *
 * @param aStart ISO 8601 UTC datetime string for the first interval start
 * @param aEnd ISO 8601 UTC datetime string for the first interval end (excluded)
 * @param bStart ISO 8601 UTC datetime string for the second interval start
 * @param bEnd ISO 8601 UTC datetime string for the second interval end (excluded)
 * @returns true if intervals overlap, or false on invalid input
 *
 * @example intervalsOverlapUtc("2024-01-01T09:00:00Z", "2024-01-01T13:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T17:00:00Z") // true
 * @example intervalsOverlapUtc("2024-01-01T09:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T17:00:00Z") // false (touching)
 * @example intervalsOverlapUtc("2024-01-01T09:00:00Z", "2024-01-01T12:00:00.000000001Z", "2024-01-01T12:00:00Z", "2024-01-01T17:00:00Z") // true (1 ns shared)
 * @example intervalsOverlapUtc("2024-01-01T09:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T12:00:00Z") // false (empty interval at the end)
 * @example intervalsOverlapUtc("invalid", "2024-06-30T23:59:59Z", "2024-04-01T00:00:00Z", "2024-12-31T23:59:59Z") // false
 */
export function intervalsOverlapUtc(
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

  return intervalsOverlap(
    { start: aStart, end: aEnd },
    { start: bStart, end: bEnd },
  );
}
