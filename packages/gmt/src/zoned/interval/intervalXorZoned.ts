// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import {
  calendarOfAllZonedValues,
  formatZonedInCalendar,
  halfOpenXor,
  parseCalendarZonedValue,
} from "../../internal";
import { isValidCalendarZonedDateTime } from "../validate";

/**
 * Return the symmetric difference of two half-open zoned intervals `[start, end)` — the instants
 * covered by exactly one interval.
 *
 * - Compares instants (`Temporal.ZonedDateTime.compare`, calendar- and zone-blind).
 * - The result is every maximal run covered by exactly one interval, sorted by start instant — the
 *   same as `mergeIntervals` of `subtractIntervals(a, [b])` and `subtractIntervals(b, [a])`, and
 *   the same as `intervalXorAllZoned([a, b])`.
 * - Every boundary is an input's own `start` or `end`, in that input's time zone (the first
 *   interval's on a tie); no boundary is stepped by a nanosecond.
 * - Touching intervals share no instant, so they join into one run. An empty interval (`start`
 *   and `end` the same instant) holds no instant and changes nothing.
 * - Returns `[]` when the intervals are identical.
 * - Returns `[{ start, end }]` when the intervals share a start or an end, or touch.
 * - Returns `[{ start, end }, { start, end }]` when they partially overlap, when one strictly
 *   contains the other (the piece before B and the piece after B), or when they are disjoint with
 *   a gap.
 * - Returns `[]` if either interval is invalid (`start > end`).
 * - Returns `[]` on invalid input (wrong type, malformed strings, leap seconds).
 * - Accepts RFC 9557 calendar-annotated zoned strings (as produced by `convertZonedToCalendar`) as
 *   well as bare ISO ones — E7 (issue #152) — but **rejects a mismatched pair**: every endpoint
 *   must name the same calendar system (E7's D4-zoned). Unlike the ordering functions, this one
 *   returns a *value* the caller reads back as a datetime, and there is no principled way to pick
 *   one endpoint's calendar as the answer's. Rejection also keeps a uniform policy across all
 *   eight value-returning zoned set operations, four of which return arrays — a per-element
 *   "winner's tag" would produce a result set whose members disagree about which calendar they
 *   are in. (`intervalUnionZoned`'s existing "winning endpoint's *time zone* wins" is not
 *   precedent: the zone is a property of the surviving point, the calendar is a property of the
 *   answer.) A mismatch returns the sentinel.
 * - Output boundaries are re-derived in the resolved calendar via `formatZonedInCalendar`, never
 *   copied from an input string (E7's D7-zoned).
 * - Rejects a calendar annotation before the time zone annotation, which is not RFC 9557.
 *
 * @param aStart ISO 8601 zoned datetime string for the first interval start
 * @param aEnd ISO 8601 zoned datetime string for the first interval end
 * @param bStart ISO 8601 zoned datetime string for the second interval start
 * @param bEnd ISO 8601 zoned datetime string for the second interval end
 * @returns array of `{ start, end }` records representing the symmetric difference, or `[]` on invalid input
 *
 * @example intervalXorZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-06-30T12:00:00+00:00[UTC]", "2024-04-01T11:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]") // partial overlap — [{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-04-01T11:00:00+00:00[UTC]" }, { start: "2024-06-30T12:00:00+00:00[UTC]", end: "2024-12-31T17:00:00+00:00[UTC]" }]
 * @example intervalXorZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]", "2024-02-01T08:00:00+00:00[UTC]", "2024-03-01T10:00:00+00:00[UTC]") // B strictly inside A — two remainder pieces — [{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-02-01T08:00:00+00:00[UTC]" }, { start: "2024-03-01T10:00:00+00:00[UTC]", end: "2024-12-31T17:00:00+00:00[UTC]" }]
 * @example intervalXorZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-06-30T12:00:00+00:00[UTC]", "2024-06-30T12:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]") // touching intervals join — [{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-12-31T17:00:00+00:00[UTC]" }]
 * @example intervalXorZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]", "2024-01-01T09:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]") // []
 * @example intervalXorZoned("invalid", "2024-06-30T12:00:00+00:00[UTC]", "2024-07-01T13:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]") // []
 */
export function intervalXorZoned(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): Array<{ start: string; end: string }> {
  // One gate for all four endpoints: `isValidCalendarZonedDateTime` covers non-strings, empty
  // strings, leap seconds (which Temporal would otherwise silently clamp to :59), unknown zones
  // and a calendar annotation before the zone, while accepting RFC 9557 calendar annotations.
  if (
    !isValidCalendarZonedDateTime(aStart) ||
    !isValidCalendarZonedDateTime(aEnd) ||
    !isValidCalendarZonedDateTime(bStart) ||
    !isValidCalendarZonedDateTime(bEnd)
  ) {
    return [];
  }

  // D4-zoned reject gate: all four endpoints must agree on a calendar, or there is no calendar to
  // express the returned value in.
  const calendar = calendarOfAllZonedValues([aStart, aEnd, bStart, bEnd]);
  if (!calendar) {
    return [];
  }

  try {
    const aSZdt = parseCalendarZonedValue(aStart);
    const aEZdt = parseCalendarZonedValue(aEnd);
    const bSZdt = parseCalendarZonedValue(bStart);
    const bEZdt = parseCalendarZonedValue(bEnd);

    if (Temporal.ZonedDateTime.compare(aSZdt, aEZdt) > 0) {
      return [];
    }

    if (Temporal.ZonedDateTime.compare(bSZdt, bEZdt) > 0) {
      return [];
    }

    // Maximal runs covered exactly once. Each boundary is the ZonedDateTime that supplied it (the
    // first interval's on a tie), so it keeps that input's zone.
    return halfOpenXor(
      [
        { start: aSZdt, end: aEZdt },
        { start: bSZdt, end: bEZdt },
      ],
      Temporal.ZonedDateTime.compare,
    ).map(({ start, end }) => ({
      start: formatZonedInCalendar(start, calendar),
      end: formatZonedInCalendar(end, calendar),
    }));
  } catch {
    return [];
  }
}
