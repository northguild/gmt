import { Temporal } from "@js-temporal/polyfill";
import { closedIntervalsAbut, parseCalendarDateValue } from "../../internal";
import { isValidCalendarDate } from "../validate";

/**
 * Return true when two date intervals are exactly adjacent — one's end is one day before the
 * other's start, so they share no date and leave no gap.
 *
 * - Uses `Temporal.PlainDate.compare` for comparison.
 * - Returns `true` when `bStart - 1 day === aEnd` (with `aEnd < bStart`) or
 *   `aStart - 1 day === bEnd` (with `bEnd < aStart`). The step is taken down from the later start,
 *   so an interval ending on the last representable date (`+275760-09-13`) still abuts.
 * - Returns `false` when intervals overlap, are disjoint with a gap, or are invalid.
 * - Returns `false` on invalid input (wrong type, malformed strings).
 * - Accepts GMT calendar-annotated PlainDate strings (as produced by `convertDateToCalendar`) —
 *   E5 (issue #78). Comparison is by calendar-independent ordering (`Temporal.PlainDate.compare`
 *   ignores calendar), so the four endpoints may carry different or no calendar tags — E5
 *   decision of record D4 (ordering-only functions accept mixed calendars).
 * - Compatibility: since 1.16.0 a calendar annotation must be a GMT `CalendarSystem` id
 *   (`[u-ca=gregory]` is now invalid input); use the GMT id — see `isValidCalendarDate`.
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

    return closedIntervalsAbut(
      aS,
      aE,
      bS,
      bE,
      Temporal.PlainDate.compare,
      (value) => value.subtract({ days: 1 }),
    );
  } catch {
    return false;
  }
}
