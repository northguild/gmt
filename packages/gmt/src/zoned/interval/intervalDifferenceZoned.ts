// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import {
  calendarOfAllZonedValues,
  formatZonedInCalendar,
  halfOpenDifference,
  parseCalendarZonedValue,
} from "../../internal";
import { isValidCalendarZonedDateTime } from "../validate";

/**
 * Return the portion(s) of the half-open interval A `[aStart, aEnd)` not covered by the half-open
 * interval B `[bStart, bEnd)`.
 *
 * - Compares instants, with the same rule as `subtractIntervals`.
 * - Every cut lands exactly on B's own `start` or `end`: the piece before B ends at `bStart`, which
 *   it excludes, and the piece after B starts at `bEnd`, which B excludes. No boundary is stepped
 *   by a nanosecond. A boundary A supplies keeps A's time zone; a cut keeps B's.
 * - Returns `[]` when B fully covers A (this includes B being identical to A), and when A is empty
 *   (`aStart` and `aEnd` the same instant).
 * - Returns `[{ start, end }]` when B overlaps exactly one edge of A.
 * - Returns `[{ start, end }, { start, end }]` when B is fully inside A with gaps on both sides.
 * - Returns A unchanged when B lies entirely before or after it, touches it, or is empty.
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
 * @returns array of `{ start, end }` records representing A minus B, or `[]` on invalid input
 *
 * @example intervalDifferenceZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]", "2024-06-01T12:00:00+00:00[UTC]", "2024-07-01T13:00:00+00:00[UTC]") // [{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-06-01T12:00:00+00:00[UTC]" }, { start: "2024-07-01T13:00:00+00:00[UTC]", end: "2024-12-31T17:00:00+00:00[UTC]" }]
 * @example intervalDifferenceZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-01-01T12:00:00+00:00[UTC]", "2024-01-01T12:00:00+00:00[UTC]", "2024-01-01T17:00:00+00:00[UTC]") // [{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-01-01T12:00:00+00:00[UTC]" }] (touching: B removes nothing)
 * @example intervalDifferenceZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]", "2024-01-01T09:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]") // []
 * @example intervalDifferenceZoned("invalid", "2024-12-31T17:00:00+00:00[UTC]", "2024-06-01T12:00:00+00:00[UTC]", "2024-07-01T13:00:00+00:00[UTC]") // []
 */
export function intervalDifferenceZoned(
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

    // The non-empty parts of A before B starts and after B ends; an empty B removes nothing. Each
    // boundary is the ZonedDateTime that supplied it, so it keeps that input's zone.
    return halfOpenDifference(
      { start: aSZdt, end: aEZdt },
      [{ start: bSZdt, end: bEZdt }],
      Temporal.ZonedDateTime.compare,
    ).map(({ start, end }) => ({
      start: formatZonedInCalendar(start, calendar),
      end: formatZonedInCalendar(end, calendar),
    }));
  } catch {
    return [];
  }
}
