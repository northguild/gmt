import { Temporal } from "@js-temporal/polyfill";
import { parseCalendarDateValue } from "../../internal";
import { isValidCalendarDate } from "../validate";

/**
 * Return how many distinct calendar dates two date intervals share.
 *
 * - Counts the number of dates touched by the closed intersection
 *   `[max(aStart, bStart), min(aEnd, bEnd)]` — inclusive of both endpoints.
 * - Adjacent intervals (e.g. `aEnd === bStart`) share one date and count as `1`.
 * - Returns `0` when the intervals do not overlap at all (a well-defined answer, not
 *   invalid input).
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, malformed strings).
 * - Diverges from date-fns's `getOverlappingDaysInIntervals`, which rounds up elapsed
 *   24-hour periods instead of counting calendar dates (its own doc example — Jan 10-20 vs
 *   Jan 17-21 — returns 3 there, 4 here). To reproduce date-fns's number, compose
 *   `intervalIntersectionDate` with `intervalCountDate`:
 *   `const span = intervalIntersectionDate(aStart, aEnd, bStart, bEnd); span ? intervalCountDate(span.start, span.end, "day") : 0;`
 *
 * - Accepts GMT calendar-annotated PlainDate strings — E5 (issue #78). A day is a day in every
 *   supported calendar, so this returns the same count whether or not the endpoints are
 *   calendar-tagged, and arguments may carry different or no tags (D4).
 *
 * @param aStart ISO 8601 date string for the first interval start, optionally calendar-annotated
 * @param aEnd ISO 8601 date string for the first interval end, optionally calendar-annotated
 * @param bStart ISO 8601 date string for the second interval start, optionally calendar-annotated
 * @param bEnd ISO 8601 date string for the second interval end, optionally calendar-annotated
 * @returns number of shared calendar dates, `0` when disjoint, or null on invalid input
 *
 * @example intervalOverlappingDaysDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31") // 91
 * @example intervalOverlappingDaysDate("2024-01-01", "2024-12-31", "2024-02-01", "2024-02-29") // 29
 * @example intervalOverlappingDaysDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31") // 1 (adjacent)
 * @example intervalOverlappingDaysDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31") // 0 (disjoint)
 * @example intervalOverlappingDaysDate("invalid", "2024-06-30", "2024-04-01", "2024-12-31") // null
 */
export function intervalOverlappingDaysDate(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): number | null {
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
      return 0;
    }

    const start = Temporal.PlainDate.compare(aS, bS) >= 0 ? aS : bS;
    const end = Temporal.PlainDate.compare(aE, bE) <= 0 ? aE : bE;

    // start/end may carry different calendars when the four arguments' tags don't all match
    // (D4: this function accepts mixed calendars since it returns a count, not a date value) —
    // Temporal.PlainDate.prototype.until throws outright across two different calendars, even
    // though .compare above does not, so both are normalized to iso8601 first. A day is the
    // same length in every supported calendar, so this never changes the answer.
    return (
      start.withCalendar("iso8601").until(end.withCalendar("iso8601"), {
        largestUnit: "day",
      }).days + 1
    );
  } catch {
    return null;
  }
}
