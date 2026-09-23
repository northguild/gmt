// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import {
  calendarOfAllZonedValues,
  formatZonedInCalendar,
  halfOpenUnion,
  parseCalendarZonedValue,
} from "../../internal";
import { isValidCalendarZonedDateTime } from "../validate";

/**
 * Return the combined span of two half-open zoned intervals `[start, end)`, or null when their
 * union is not one non-empty span.
 *
 * - Uses `Temporal.ZonedDateTime.compare` for comparison (same instant semantics).
 * - The result is the single run `mergeIntervalsZoned([a, b])` produces, the same rule as
 *   `mergeIntervals`. Overlapping intervals return their merged span, and each boundary keeps the
 *   time zone of the interval that contributed it.
 * - Touching intervals (e.g. `aEnd` the same instant as `bStart`) leave no gap between them and
 *   ARE merged.
 * - An empty interval (`start` and `end` the same instant) holds no instant, so it never changes
 *   the result: with a non-empty interval the answer is that interval, and two empty intervals
 *   give `null`.
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, malformed strings, leap seconds).
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
 * @returns `{ start, end }` with the merged span, or null on invalid input / disjoint intervals
 *
 * @example intervalUnionZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-06-30T23:59:59+00:00[UTC]", "2024-04-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // { start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-12-31T23:59:59+00:00[UTC]" }
 * @example intervalUnionZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-01-01T12:00:00+00:00[UTC]", "2024-01-01T12:00:00+00:00[UTC]", "2024-01-01T17:00:00+00:00[UTC]") // { start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-01-01T17:00:00+00:00[UTC]" } (touching)
 * @example intervalUnionZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-01-01T12:00:00+00:00[UTC]", "2024-01-01T12:00:00.000000001+00:00[UTC]", "2024-01-01T17:00:00+00:00[UTC]") // null (one-nanosecond gap)
 * @example intervalUnionZoned("invalid", "2024-06-30T23:59:59+00:00[UTC]", "2024-04-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // null
 */
export function intervalUnionZoned(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): { start: string; end: string } | null {
  // One gate for all four endpoints: `isValidCalendarZonedDateTime` covers non-strings, empty
  // strings, leap seconds (which Temporal would otherwise silently clamp to :59), unknown zones
  // and a calendar annotation before the zone, while accepting RFC 9557 calendar annotations.
  if (
    !isValidCalendarZonedDateTime(aStart) ||
    !isValidCalendarZonedDateTime(aEnd) ||
    !isValidCalendarZonedDateTime(bStart) ||
    !isValidCalendarZonedDateTime(bEnd)
  ) {
    return null;
  }

  // D4-zoned reject gate: all four endpoints must agree on a calendar, or there is no calendar to
  // express the returned value in.
  const calendar = calendarOfAllZonedValues([aStart, aEnd, bStart, bEnd]);
  if (!calendar) {
    return null;
  }

  try {
    const aZdt = parseCalendarZonedValue(aStart);
    const aZde = parseCalendarZonedValue(aEnd);
    const bZdt = parseCalendarZonedValue(bStart);
    const bZde = parseCalendarZonedValue(bEnd);

    if (Temporal.ZonedDateTime.compare(aZdt, aZde) > 0) {
      return null;
    }

    if (Temporal.ZonedDateTime.compare(bZdt, bZde) > 0) {
      return null;
    }

    // One merged run, or null when a gap (or no instant at all) leaves no single span.
    const union = halfOpenUnion(
      { start: aZdt, end: aZde },
      { start: bZdt, end: bZde },
      Temporal.ZonedDateTime.compare,
    );

    return union === null
      ? null
      : {
          start: formatZonedInCalendar(union.start, calendar),
          end: formatZonedInCalendar(union.end, calendar),
        };
  } catch {
    return null;
  }
}
