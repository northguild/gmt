import { Temporal } from "@js-temporal/polyfill";
import {
  calendarOfAllDateValues,
  formatDateInCalendar,
  parseCalendarDateValue,
} from "../../internal";
import { isValidCalendarDate } from "../validate";

/**
 * Return the symmetric difference of two date intervals — time covered by exactly one interval.
 *
 * - Uses `Temporal.PlainDate.compare` for comparison.
 * - Returns `[]` when intervals are identical or both invalid.
 * - Returns `[{ start, end }]` when one interval fully contains the other.
 * - Returns `[{ start, end }, { start, end }]` when intervals partially overlap (two non-overlapping pieces).
 * - Returns `[]` if either interval is invalid (`start > end`).
 * - Returns `[]` on invalid input (wrong type, malformed strings).
 * - Accepts GMT calendar-annotated PlainDate strings — E5 (issue #78). Since the result is
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
 * @example intervalXorDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31") // [{ start: "2024-01-01", end: "2024-03-31" }, { start: "2024-07-01", end: "2024-12-31" }]
 * @example intervalXorDate("2024-01-01", "2024-12-31", "2024-04-01", "2024-06-30") // [{ start: "2024-01-01", end: "2024-03-31" }, { start: "2024-07-01", end: "2024-12-31" }]
 * @example intervalXorDate("2024-01-01", "2024-12-31", "2024-01-01", "2024-12-31") // []
 * @example intervalXorDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31") // [{ start: "2024-01-01", end: "2024-06-30" }, { start: "2024-07-01", end: "2024-12-31" }]
 * @example intervalXorDate("invalid", "2024-06-30", "2024-07-01", "2024-12-31") // []
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

    const result: Array<{ start: string; end: string }> = [];

    // If intervals don't overlap, return both as-is
    if (
      Temporal.PlainDate.compare(aE, bS) < 0 ||
      Temporal.PlainDate.compare(bE, aS) < 0
    ) {
      return [
        {
          start: formatDateInCalendar(aS, calendar),
          end: formatDateInCalendar(aE, calendar),
        },
        {
          start: formatDateInCalendar(bS, calendar),
          end: formatDateInCalendar(bE, calendar),
        },
      ];
    }

    // Left piece: A before B starts
    if (Temporal.PlainDate.compare(aS, bS) < 0) {
      result.push({
        start: formatDateInCalendar(aS, calendar),
        end: formatDateInCalendar(bS.subtract({ days: 1 }), calendar),
      });
    }

    // Right piece: A after B ends
    if (Temporal.PlainDate.compare(aE, bE) > 0) {
      result.push({
        start: formatDateInCalendar(bE.add({ days: 1 }), calendar),
        end: formatDateInCalendar(aE, calendar),
      });
    }

    // Left piece: B before A starts
    if (Temporal.PlainDate.compare(bS, aS) < 0) {
      result.push({
        start: formatDateInCalendar(bS, calendar),
        end: formatDateInCalendar(aS.subtract({ days: 1 }), calendar),
      });
    }

    // Right piece: B after A ends
    if (Temporal.PlainDate.compare(bE, aE) > 0) {
      result.push({
        start: formatDateInCalendar(aE.add({ days: 1 }), calendar),
        end: formatDateInCalendar(bE, calendar),
      });
    }

    return result;
  } catch {
    return [];
  }
}
