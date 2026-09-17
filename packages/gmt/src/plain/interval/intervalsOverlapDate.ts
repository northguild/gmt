// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { halfOpenOverlap, parseCalendarDateValue } from "../../internal";
import { isValidCalendarDate } from "../validate";

/**
 * Return true when the half-open date intervals `[aStart, aEnd)` and `[bStart, bEnd)` share at
 * least one day.
 *
 * - Half-open: an interval holds every date `d` with `start <= d < end`, so `end` itself is not
 *   in it (the rule CORE-6's `intervalsOverlap` uses). The test is `aStart < bEnd && bStart < aEnd`.
 * - Touching intervals (`aEnd` equal to `bStart`) share no day and do not overlap.
 * - An empty interval (`start === end`) overlaps only an interval it lies strictly inside.
 * - Uses `Temporal.PlainDate.compare` for comparison.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input (wrong type, malformed strings).
 * - Accepts RFC 9557 calendar-annotated PlainDate strings — E5 (issue #78). Ordering is
 *   calendar-independent, so arguments may carry different or no calendar tags (D4).
 * - Compatibility: since 1.16.0 calendar strings are RFC 9557 (ISO digits, `[u-ca=<id>]`, canonical
 *   calendar ids); see `isValidCalendarDate`.
 *
 * @param aStart ISO 8601 date string for the first interval start, optionally calendar-annotated
 * @param aEnd ISO 8601 date string for the first interval end (excluded), optionally calendar-annotated
 * @param bStart ISO 8601 date string for the second interval start, optionally calendar-annotated
 * @param bEnd ISO 8601 date string for the second interval end (excluded), optionally calendar-annotated
 * @returns true if intervals overlap, or false on invalid input
 *
 * @example intervalsOverlapDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31") // true
 * @example intervalsOverlapDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31") // false (touching: A ends before 06-30)
 * @example intervalsOverlapDate("2024-01-01", "2024-06-30", "2024-06-29", "2024-07-01") // true (both hold 06-29)
 * @example intervalsOverlapDate("2024-01-01", "2024-06-30", "2024-07-02", "2024-12-31") // false (disjoint)
 * @example intervalsOverlapDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-06-30") // false (empty interval at the end)
 * @example intervalsOverlapDate("invalid", "2024-06-30", "2024-04-01", "2024-12-31") // false
 */
export function intervalsOverlapDate(
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
    !isValidCalendarDate(aStart) ||
    !isValidCalendarDate(aEnd) ||
    !isValidCalendarDate(bStart) ||
    !isValidCalendarDate(bEnd)
  ) {
    return false;
  }

  try {
    const aS = parseCalendarDateValue(aStart);
    const aE = parseCalendarDateValue(aEnd);
    const bS = parseCalendarDateValue(bStart);
    const bE = parseCalendarDateValue(bEnd);

    if (Temporal.PlainDate.compare(aS, aE) > 0) {
      return false;
    }

    if (Temporal.PlainDate.compare(bS, bE) > 0) {
      return false;
    }

    return halfOpenOverlap(
      { start: aS, end: aE },
      { start: bS, end: bE },
      Temporal.PlainDate.compare,
    );
  } catch {
    return false;
  }
}
