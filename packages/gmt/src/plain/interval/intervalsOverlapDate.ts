import { Temporal } from "@js-temporal/polyfill";
import { parseCalendarDateValue } from "../../internal";
import { isValidCalendarDate } from "../validate";

/**
 * Return true when intervals `[aStart, aEnd]` and `[bStart, bEnd]` share at least one instant.
 *
 * - Uses `Temporal.PlainDate.compare` for comparison.
 * - Adjacent intervals (e.g. `aEnd === bStart`) do NOT overlap — returns `false`.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input (wrong type, malformed strings).
 * - Accepts GMT calendar-annotated PlainDate strings — E5 (issue #78). Ordering is
 *   calendar-independent, so arguments may carry different or no calendar tags (D4).
 *
 * @param aStart ISO 8601 date string for the first interval start, optionally calendar-annotated
 * @param aEnd ISO 8601 date string for the first interval end, optionally calendar-annotated
 * @param bStart ISO 8601 date string for the second interval start, optionally calendar-annotated
 * @param bEnd ISO 8601 date string for the second interval end, optionally calendar-annotated
 * @returns true if intervals overlap, or false on invalid input
 *
 * @example intervalsOverlapDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31") // true
 * @example intervalsOverlapDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31") // false (adjacent)
 * @example intervalsOverlapDate("2024-01-01", "2024-06-30", "2024-07-02", "2024-12-31") // false (disjoint)
 * @example intervalsOverlapDate("2024-01-01", "2024-06-30", "2024-02-01", "2024-03-01") // true (partial)
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

    return (
      Temporal.PlainDate.compare(aE, bS) >= 0 &&
      Temporal.PlainDate.compare(bE, aS) >= 0
    );
  } catch {
    return false;
  }
}
