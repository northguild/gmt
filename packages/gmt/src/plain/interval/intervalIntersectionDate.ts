import { Temporal } from "@js-temporal/polyfill";
import {
  calendarOfAllDateValues,
  formatDateInCalendar,
  parseCalendarDateValue,
} from "../../internal";
import { isValidCalendarDate } from "../validate";

/**
 * Return the overlapping span of two date intervals, or null when they do not overlap.
 *
 * - Uses `Temporal.PlainDate.compare` for comparison.
 * - Adjacent intervals (e.g. `aEnd === bStart`) share one instant and DO overlap.
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, malformed strings).
 * - Accepts GMT calendar-annotated PlainDate strings — E5 (issue #78). Since the result is a
 *   date *value*, all four arguments must carry the *same* calendar tag (or all be bare ISO);
 *   a mismatch returns `null` (E5 decision of record D4). The output's tag is re-derived from
 *   the intersection span, never copied from an input.
 *
 * @param aStart ISO 8601 date string for the first interval start, optionally calendar-annotated
 * @param aEnd ISO 8601 date string for the first interval end, optionally calendar-annotated
 * @param bStart ISO 8601 date string for the second interval start, optionally calendar-annotated
 * @param bEnd ISO 8601 date string for the second interval end, optionally calendar-annotated
 * @returns `{ start, end }` with the overlapping span, or null on invalid input / no overlap / mismatched calendars
 *
 * @example intervalIntersectionDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31") // { start: "2024-04-01", end: "2024-06-30" }
 * @example intervalIntersectionDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31") // { start: "2024-06-30", end: "2024-06-30" }
 * @example intervalIntersectionDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31") // null
 * @example intervalIntersectionDate("2024-01-01", "2024-06-30", "2024-02-01", "2024-03-01") // { start: "2024-02-01", end: "2024-03-01" }
 * @example intervalIntersectionDate("invalid", "2024-06-30", "2024-04-01", "2024-12-31") // null
 */
export function intervalIntersectionDate(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): { start: string; end: string } | null {
  if (
    typeof aStart !== "string" ||
    typeof aEnd !== "string" ||
    typeof bStart !== "string" ||
    typeof bEnd !== "string"
  ) {
    return null;
  }

  if (
    !isValidCalendarDate(aStart) ||
    !isValidCalendarDate(aEnd) ||
    !isValidCalendarDate(bStart) ||
    !isValidCalendarDate(bEnd)
  ) {
    return null;
  }

  const calendar = calendarOfAllDateValues([aStart, aEnd, bStart, bEnd]);
  if (!calendar) {
    return null;
  }

  try {
    const aS = parseCalendarDateValue(aStart);
    const aE = parseCalendarDateValue(aEnd);
    const bS = parseCalendarDateValue(bStart);
    const bE = parseCalendarDateValue(bEnd);

    if (Temporal.PlainDate.compare(aS, aE) > 0) {
      return null;
    }

    if (Temporal.PlainDate.compare(bS, bE) > 0) {
      return null;
    }

    if (
      Temporal.PlainDate.compare(aE, bS) < 0 ||
      Temporal.PlainDate.compare(bE, aS) < 0
    ) {
      return null;
    }

    const start = Temporal.PlainDate.compare(aS, bS) >= 0 ? aS : bS;
    const end = Temporal.PlainDate.compare(aE, bE) <= 0 ? aE : bE;

    return {
      start: formatDateInCalendar(start, calendar),
      end: formatDateInCalendar(end, calendar),
    };
  } catch {
    return null;
  }
}
