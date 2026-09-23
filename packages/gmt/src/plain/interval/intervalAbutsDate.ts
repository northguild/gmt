// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { halfOpenAbuts, parseCalendarDateValue } from "../../internal";
import { isValidCalendarDate } from "../validate";

/**
 * Return true when two half-open date intervals `[aStart, aEnd)` and `[bStart, bEnd)` are exactly
 * adjacent — one ends where the other starts, so they share nothing and leave no gap.
 *
 * - Half-open: an interval holds every `t` with `start <= t < end`, so an interval's `end` is the
 *   first value after it. Returns `true` when `aEnd === bStart` or `bEnd === aStart` (Allen's
 *   "meets"). There is no one-day step: a one-day gap is a gap.
 * - An empty interval (`start === end`) abuts nothing.
 * - Uses `Temporal.PlainDate.compare` for comparison.
 * - Returns `false` when intervals overlap, are disjoint with a gap, or are invalid.
 * - Returns `false` on invalid input (wrong type, malformed strings).
 * - Accepts RFC 9557 calendar-annotated PlainDate strings (as produced by `convertDateToCalendar`) —
 *   E5 (issue #78). Comparison is by calendar-independent ordering (`Temporal.PlainDate.compare`
 *   ignores calendar), so the four endpoints may carry different or no calendar tags — E5
 *   decision of record D4 (ordering-only functions accept mixed calendars).
 * - Compatibility: since 1.16.0 calendar strings are RFC 9557 (ISO digits, `[u-ca=<id>]`, canonical
 *   calendar ids); see `isValidCalendarDate`.
 *
 * @param aStart ISO 8601 date string for the first interval start, optionally calendar-annotated
 * @param aEnd ISO 8601 date string for the first interval end, optionally calendar-annotated
 * @param bStart ISO 8601 date string for the second interval start, optionally calendar-annotated
 * @param bEnd ISO 8601 date string for the second interval end, optionally calendar-annotated
 * @returns true if intervals are exactly adjacent, or false on invalid input
 *
 * @example intervalAbutsDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31") // true
 * @example intervalAbutsDate("2024-06-30", "2024-12-31", "2024-01-01", "2024-06-30") // true
 * @example intervalAbutsDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31") // false ([01-01, 06-30) ends before 06-30)
 * @example intervalAbutsDate("2024-01-01", "2024-07-01", "2024-06-30", "2024-12-31") // false (overlap)
 * @example intervalAbutsDate("invalid", "2024-06-30", "2024-07-01", "2024-12-31") // false
 */
export function intervalAbutsDate(
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

    return halfOpenAbuts(
      { start: aS, end: aE },
      { start: bS, end: bE },
      Temporal.PlainDate.compare,
    );
  } catch {
    return false;
  }
}
