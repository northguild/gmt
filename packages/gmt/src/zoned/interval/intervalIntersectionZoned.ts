import { Temporal } from "@js-temporal/polyfill";
import {
  calendarOfAllZonedValues,
  formatZonedInCalendar,
  parseCalendarZonedValue,
} from "../../internal";
import { isValidCalendarZonedDateTime } from "../validate";

/**
 * Return the overlapping span of two zoned intervals, or null when they do not overlap.
 *
 * - Uses `Temporal.ZonedDateTime.compare` for comparison (same instant semantics).
 * - Adjacent intervals (e.g. `aEnd === bStart`) share one instant and DO overlap.
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, malformed strings, leap seconds).
 * - Accepts GMT calendar-annotated zoned strings (as produced by `convertZonedToCalendar`) as
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
 * - Still rejects Temporal's own `[timeZone][u-ca=...]` RFC 9557 ordering — see
 *   `regex/calendar-zoned-date-time.ts`.
 *
 * @param aStart ISO 8601 zoned datetime string for the first interval start
 * @param aEnd ISO 8601 zoned datetime string for the first interval end
 * @param bStart ISO 8601 zoned datetime string for the second interval start
 * @param bEnd ISO 8601 zoned datetime string for the second interval end
 * @returns `{ start, end }` with the overlapping span, or null on invalid input / no overlap
 *
 * @example intervalIntersectionZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-06-30T23:59:59+00:00[UTC]", "2024-04-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // { start: "2024-04-01T00:00:00+00:00[UTC]", end: "2024-06-30T23:59:59+00:00[UTC]" }
 * @example intervalIntersectionZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-06-30T23:59:59+00:00[UTC]", "2024-07-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // null
 * @example intervalIntersectionZoned("invalid", "2024-06-30T23:59:59+00:00[UTC]", "2024-04-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // null
 */
export function intervalIntersectionZoned(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): { start: string; end: string } | null {
  // One gate for all four endpoints: `isValidCalendarZonedDateTime` covers non-strings, empty
  // strings, leap seconds (which Temporal would otherwise silently clamp to :59), unknown zones
  // and Temporal's forbidden segment ordering, while accepting GMT's calendar-annotated grammar.
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

    if (
      Temporal.ZonedDateTime.compare(aZde, bZdt) < 0 ||
      Temporal.ZonedDateTime.compare(bZde, aZdt) < 0
    ) {
      return null;
    }

    const start = Temporal.ZonedDateTime.compare(aZdt, bZdt) >= 0 ? aZdt : bZdt;
    const end = Temporal.ZonedDateTime.compare(aZde, bZde) <= 0 ? aZde : bZde;

    return {
      start: formatZonedInCalendar(start, calendar),
      end: formatZonedInCalendar(end, calendar),
    };
  } catch {
    return null;
  }
}
