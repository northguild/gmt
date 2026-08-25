import { Temporal } from "@js-temporal/polyfill";
import {
  calendarOfAllDateValues,
  formatDateInCalendar,
  parseCalendarDateValue,
} from "../../internal";
import { isValidCalendarDate } from "../validate";

/**
 * Return the portion(s) of interval A not covered by interval B.
 *
 * - Uses `Temporal.PlainDate.compare` for comparison.
 * - Returns `[]` when B fully covers A.
 * - Returns `[{ start, end }]` when B overlaps one edge of A (or equals A).
 * - Returns `[{ start, end }, { start, end }]` when B is fully inside A with gaps on both sides.
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
 * @returns array of `{ start, end }` records representing A minus B, or `[]` on invalid input / mismatched calendars
 *
 * @example intervalDifferenceDate("2024-01-01", "2024-12-31", "2024-06-01", "2024-07-01") // [{ start: "2024-01-01", end: "2024-05-31" }, { start: "2024-07-02", end: "2024-12-31" }]
 * @example intervalDifferenceDate("2024-01-01", "2024-12-31", "2024-03-01", "2024-10-31") // [{ start: "2024-01-01", end: "2024-02-29" }, { start: "2024-11-01", end: "2024-12-31" }]
 * @example intervalDifferenceDate("2024-01-01", "2024-12-31", "2024-01-01", "2024-12-31") // []
 * @example intervalDifferenceDate("2024-01-01", "2024-12-31", "2024-06-01", "2024-12-31") // [{ start: "2024-01-01", end: "2024-05-31" }]
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

    const result: Array<{ start: string; end: string }> = [];

    // Left piece: A before B starts
    if (Temporal.PlainDate.compare(aS, bS) < 0) {
      const leftEnd =
        Temporal.PlainDate.compare(
          Temporal.PlainDate.compare(aE, bS) < 0
            ? aE
            : bS.subtract({ days: 1 }),
          aS,
        ) >= 0
          ? Temporal.PlainDate.compare(aE, bS) < 0
            ? aE
            : bS.subtract({ days: 1 })
          : null;

      if (leftEnd !== null && Temporal.PlainDate.compare(leftEnd, aS) >= 0) {
        result.push({
          start: formatDateInCalendar(aS, calendar),
          end: formatDateInCalendar(leftEnd, calendar),
        });
      }
    }

    // Right piece: A after B ends
    if (Temporal.PlainDate.compare(aE, bE) > 0) {
      result.push({
        start: formatDateInCalendar(bE.add({ days: 1 }), calendar),
        end: formatDateInCalendar(aE, calendar),
      });
    }

    return result;
  } catch {
    return [];
  }
}
