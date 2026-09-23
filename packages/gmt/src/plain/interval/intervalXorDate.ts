// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import {
  calendarOfAllDateValues,
  formatDateInCalendar,
  halfOpenXor,
  parseCalendarDateValue,
} from "../../internal";
import { isValidCalendarDate } from "../validate";

/**
 * Return the symmetric difference of two date intervals — time covered by exactly one interval.
 *
 * - Half-open: an interval holds every `t` with `start <= t < end`. The result is every maximal
 *   run covered by exactly one of the two intervals, sorted by start — the same set as
 *   CORE-6's `mergeIntervals([...subtractIntervals(a, [b]), ...subtractIntervals(b, [a])])`.
 * - Pieces end exactly where the other interval starts; no piece is stepped by one day.
 * - Touching intervals (`aEnd === bStart`) share nothing, so they return one combined run.
 * - Returns `[]` when the intervals are identical. An empty interval contributes nothing.
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
 * @returns array of `{ start, end }` records representing the symmetric difference, or `[]` on invalid input / mismatched calendars
 *
 * @example intervalXorDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31") // [{ start: "2024-01-01", end: "2024-04-01" }, { start: "2024-06-30", end: "2024-12-31" }]
 * @example intervalXorDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31") // [{ start: "2024-01-01", end: "2024-12-31" }] (touching)
 * @example intervalXorDate("2024-01-01", "2024-12-31", "2024-01-01", "2024-12-31") // []
 * @example intervalXorDate("invalid", "2024-06-30", "2024-04-01", "2024-12-31") // []
 */
export function intervalXorDate(
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

    return halfOpenXor(
      [
        { start: aS, end: aE },
        { start: bS, end: bE },
      ],
      Temporal.PlainDate.compare,
    ).map(({ start, end }) => ({
      start: formatDateInCalendar(start, calendar),
      end: formatDateInCalendar(end, calendar),
    }));
  } catch {
    return [];
  }
}
