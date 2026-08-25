import { Temporal } from "@js-temporal/polyfill";
import { parseCalendarDateValue } from "../../internal";
import { isValidCalendarDate } from "../validate";

/**
 * Return true when two date intervals are exactly adjacent — one's end equals the other's start
 * with zero gap and zero overlap.
 *
 * - Uses `Temporal.PlainDate.compare` for comparison.
 * - Returns `true` when `aEnd + 1 day === bStart` or `bEnd + 1 day === aStart`.
 * - Returns `false` when intervals overlap, are disjoint with a gap, or are invalid.
 * - Returns `false` on invalid input (wrong type, malformed strings).
 * - Accepts GMT calendar-annotated PlainDate strings (as produced by `convertDateToCalendar`) —
 *   E5 (issue #78). Comparison is by calendar-independent ordering (`Temporal.PlainDate.compare`
 *   ignores calendar), so the four endpoints may carry different or no calendar tags — E5
 *   decision of record D4 (ordering-only functions accept mixed calendars).
 *
 * @param aStart ISO 8601 date string for the first interval start, optionally calendar-annotated
 * @param aEnd ISO 8601 date string for the first interval end, optionally calendar-annotated
 * @param bStart ISO 8601 date string for the second interval start, optionally calendar-annotated
 * @param bEnd ISO 8601 date string for the second interval end, optionally calendar-annotated
 * @returns true if intervals are exactly adjacent, or false on invalid input
 *
 * @example intervalAbutsDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31") // true
 * @example intervalAbutsDate("2024-07-01", "2024-12-31", "2024-01-01", "2024-06-30") // true
 * @example intervalAbutsDate("2024-01-01", "2024-06-30", "2024-07-02", "2024-12-31") // false (gap)
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

    // aEnd + 1 day === bStart
    const aEndPlusOne = aE.add({ days: 1 });
    if (Temporal.PlainDate.compare(aEndPlusOne, bS) === 0) {
      return true;
    }

    // bEnd + 1 day === aStart
    const bEndPlusOne = bE.add({ days: 1 });
    if (Temporal.PlainDate.compare(bEndPlusOne, aS) === 0) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
