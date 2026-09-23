// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { halfOpenOverlap } from "../../internal";
import { isValidDateTime } from "../validate";

/**
 * Return true when the half-open datetime intervals `[aStart, aEnd)` and `[bStart, bEnd)` share at
 * least one moment.
 *
 * - Half-open: an interval holds every `t` with `start <= t < end`, so `end` itself is not in it
 *   (the rule CORE-6's `intervalsOverlap` uses). The test is `aStart < bEnd && bStart < aEnd`.
 * - Touching intervals (`aEnd` equal to `bStart`) share no moment and do not overlap.
 * - An empty interval (`start === end`) overlaps only an interval it lies strictly inside.
 * - Uses `Temporal.PlainDateTime.compare` for comparison.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 datetime string for the first interval start
 * @param aEnd ISO 8601 datetime string for the first interval end (excluded)
 * @param bStart ISO 8601 datetime string for the second interval start
 * @param bEnd ISO 8601 datetime string for the second interval end (excluded)
 * @returns true if intervals overlap, or false on invalid input
 *
 * @example intervalsOverlapDateTime("2024-01-01T09:00:00", "2024-01-01T13:00:00", "2024-01-01T12:00:00", "2024-01-01T17:00:00") // true
 * @example intervalsOverlapDateTime("2024-01-01T09:00:00", "2024-01-01T12:00:00", "2024-01-01T12:00:00", "2024-01-01T17:00:00") // false (touching)
 * @example intervalsOverlapDateTime("2024-01-01T09:00:00", "2024-01-01T17:00:00", "2024-01-01T12:00:00", "2024-01-01T12:00:00") // true (empty interval strictly inside)
 * @example intervalsOverlapDateTime("2024-01-01T09:00:00", "2024-01-01T12:00:00", "2024-01-01T12:00:00", "2024-01-01T12:00:00") // false (empty interval at the end)
 * @example intervalsOverlapDateTime("invalid", "2024-06-30T23:59:59", "2024-04-01T00:00:00", "2024-12-31T23:59:59") // false
 */
export function intervalsOverlapDateTime(
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

    return halfOpenOverlap(
      { start: aS, end: aE },
      { start: bS, end: bE },
      Temporal.PlainDateTime.compare,
    );
  } catch {
    return false;
  }
}
