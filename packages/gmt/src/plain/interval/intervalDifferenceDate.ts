// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import {
  calendarOfAllDateValues,
  formatDateInCalendar,
  halfOpenDifference,
  parseCalendarDateValue,
} from "../../internal";
import { isValidCalendarDate } from "../validate";

/**
 * Return the portion(s) of interval A not covered by interval B.
 *
 * - Uses `Temporal.PlainDate.compare` for comparison.
 * - Half-open: an interval holds every date `d` with `start <= d < end`. A returned piece ends exactly
 *   where B starts, or starts exactly where B ends, because B's `end` is not in B (CORE-6's
 *   `subtractIntervals`). No piece is stepped by one day.
 * - B touching A (`bStart === aEnd` or `bEnd === aStart`), or empty, removes nothing.
 * - An empty A (`aStart === aEnd`) has nothing left: returns `[]`. Every returned piece is non-empty.
 * - `end` is the first day after the period: for a period whose last day is `last`, pass
 *   `addDate(last, { days: 1 })`.
 * - Returns `[]` when B fully covers A.
 * - Returns `[{ start, end }]` when B overlaps one edge of A (or equals A).
 * - Returns `[{ start, end }, { start, end }]` when B is fully inside A with gaps on both sides.
 * - Returns A unchanged when B lies entirely before or after it.
 * - Returns `[]` if either interval is invalid (`start > end`).
 * - Returns `[]` on invalid input (wrong type, malformed strings).
 * - Accepts RFC 9557 calendar-annotated PlainDate strings — E5 (issue #78). Since the result is
 *   date *values*, all four arguments must carry the *same* calendar tag (or all be bare ISO);
 *   a mismatch returns `[]` (E5 decision of record D4). Each output piece's tag is re-derived,
 *   never copied from an input.
 *
 * @param aStart ISO 8601 date string for the first interval start, optionally calendar-annotated
 * @param aEnd ISO 8601 date string for the first interval end, optionally calendar-annotated
 * @param bStart ISO 8601 date string for the second interval start, optionally calendar-annotated
 * @param bEnd ISO 8601 date string for the second interval end, optionally calendar-annotated
 * @returns array of `{ start, end }` records representing A minus B, or `[]` on invalid input / mismatched calendars
 *
 * @example intervalDifferenceDate("2024-01-01", "2024-12-31", "2024-06-01", "2024-07-01") // [{ start: "2024-01-01", end: "2024-06-01" }, { start: "2024-07-01", end: "2024-12-31" }]
 * @example intervalDifferenceDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31") // [{ start: "2024-01-01", end: "2024-06-30" }] (touching B removes nothing)
 * @example intervalDifferenceDate("2024-01-01", "2024-12-31", "2024-01-01", "2024-12-31") // []
 * @example intervalDifferenceDate("invalid", "2024-12-31", "2024-06-01", "2024-07-01") // []
 */
export function intervalDifferenceDate(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): Array<{ start: string; end: string }> {
  if (
    typeof aStart !== "string" ||
    typeof aEnd !== "string" ||
    typeof bStart !== "string" ||
    typeof bEnd !== "string"
  ) {
    return [];
  }

  if (
    !isValidCalendarDate(aStart) ||
    !isValidCalendarDate(aEnd) ||
    !isValidCalendarDate(bStart) ||
    !isValidCalendarDate(bEnd)
  ) {
    return [];
  }

  const calendar = calendarOfAllDateValues([aStart, aEnd, bStart, bEnd]);
  if (!calendar) {
    return [];
  }

  try {
    const aS = parseCalendarDateValue(aStart);
    const aE = parseCalendarDateValue(aEnd);
    const bS = parseCalendarDateValue(bStart);
    const bE = parseCalendarDateValue(bEnd);

    if (Temporal.PlainDate.compare(aS, aE) > 0) {
      return [];
    }

    if (Temporal.PlainDate.compare(bS, bE) > 0) {
      return [];
    }

    return halfOpenDifference(
      { start: aS, end: aE },
      [{ start: bS, end: bE }],
      Temporal.PlainDate.compare,
    ).map(({ start, end }) => ({
      start: formatDateInCalendar(start, calendar),
      end: formatDateInCalendar(end, calendar),
    }));
  } catch {
    return [];
  }
}
