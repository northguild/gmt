// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import {
  calendarOfAllDateValues,
  formatDateInCalendar,
  halfOpenUnion,
  parseCalendarDateValue,
} from "../../internal";
import { isValidCalendarDate } from "../validate";

/**
 * Return the combined span of two date intervals, or null when they are disjoint.
 *
 * - Uses `Temporal.PlainDate.compare` for comparison.
 * - Half-open: an interval holds every `t` with `start <= t < end`. The union is returned only
 *   when it is one non-empty interval — the single run CORE-6's `mergeIntervals` would give.
 * - Overlapping intervals, and touching intervals (`aEnd === bStart`), return their combined span.
 * - Two **non-empty** intervals with any gap between them return `null`, even a one-unit gap.
 *   The caveat matters: an empty interval is the empty set, so it is never “separated” from
 *   anything. A non-empty interval unioned with an empty one far away is still that non-empty
 *   interval — see the next bullet — not `null`.
 * - An empty interval (`start === end`) is the empty set: it adds nothing, so the union is the
 *   other interval. Two empty intervals have no non-empty union and return `null`.
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, malformed strings).
 * - Accepts RFC 9557 calendar-annotated PlainDate strings — E5 (issue #78). Since the result is a
 *   date *value*, all four arguments must carry the *same* calendar tag (or all be bare ISO);
 *   a mismatch returns `null` rather than guessing an output calendar (E5 decision of record
 *   D4). The output's tag is re-derived from the merged span, never copied from an input.
 *
 * @param aStart ISO 8601 date string for the first interval start, optionally calendar-annotated
 * @param aEnd ISO 8601 date string for the first interval end, optionally calendar-annotated
 * @param bStart ISO 8601 date string for the second interval start, optionally calendar-annotated
 * @param bEnd ISO 8601 date string for the second interval end, optionally calendar-annotated
 * @returns `{ start, end }` with the merged span, or null on invalid input / disjoint intervals / mismatched calendars
 *
 * @example intervalUnionDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31") // { start: "2024-01-01", end: "2024-12-31" }
 * @example intervalUnionDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31") // { start: "2024-01-01", end: "2024-12-31" } (touching)
 * @example intervalUnionDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31") // null (06-30 is in neither)
 * @example intervalUnionDate("2024-01-05", "2024-01-05", "2024-06-15", "2024-06-30") // { start: "2024-06-15", end: "2024-06-30" } (empty interval adds nothing)
 * @example intervalUnionDate("invalid", "2024-06-30", "2024-04-01", "2024-12-31") // null
 * @example intervalUnionDate("2024-01-01[u-ca=hebrew]", "2024-06-30", "2024-04-01", "2024-12-31") // null (mismatched calendars)
 */
export function intervalUnionDate(
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

    const union = halfOpenUnion(
      { start: aS, end: aE },
      { start: bS, end: bE },
      Temporal.PlainDate.compare,
    );

    if (union === null) {
      return null;
    }

    const { start, end } = union;

    return {
      start: formatDateInCalendar(start, calendar),
      end: formatDateInCalendar(end, calendar),
    };
  } catch {
    return null;
  }
}
