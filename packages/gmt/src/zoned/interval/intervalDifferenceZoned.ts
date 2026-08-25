import { Temporal } from "@js-temporal/polyfill";
import {
  calendarOfAllZonedValues,
  formatZonedInCalendar,
  parseCalendarZonedValue,
} from "../../internal";
import { isValidCalendarZonedDateTime } from "../validate";

/**
 * Return the portion(s) of interval A not covered by interval B.
 *
 * - Uses `Temporal.Instant.compare` for comparison (via `.toInstant()`).
 * - Returns `[]` when B fully covers A.
 * - Returns `[{ start, end }]` when B overlaps one edge of A (or equals A).
 * - Returns `[{ start, end }, { start, end }]` when B is fully inside A with gaps on both sides.
 * - Returns `[]` if either interval is invalid (`start > end`).
 * - Returns `[]` on invalid input (wrong type, malformed strings, leap seconds).
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
 * @returns array of `{ start, end }` records representing A minus B, or `[]` on invalid input
 *
 * @example intervalDifferenceZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]", "2024-06-01T12:00:00+00:00[UTC]", "2024-07-01T13:00:00+00:00[UTC]") // [{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-05-31T17:00:00+00:00[UTC]" }, { start: "2024-07-01T13:00:01+00:00[UTC]", end: "2024-12-31T17:00:00+00:00[UTC]" }]
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
  // and Temporal's forbidden segment ordering, while accepting GMT's calendar-annotated grammar.
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

    const aS = aSZdt.toInstant();
    const aE = aEZdt.toInstant();
    const bS = bSZdt.toInstant();
    const bE = bEZdt.toInstant();

    if (Temporal.Instant.compare(aS, aE) > 0) {
      return [];
    }

    if (Temporal.Instant.compare(bS, bE) > 0) {
      return [];
    }

    const result: Array<{ start: string; end: string }> = [];

    // Left piece: A before B starts
    if (Temporal.Instant.compare(aS, bS) < 0) {
      const leftEnd =
        Temporal.Instant.compare(aE, bS) < 0
          ? aE
          : bS.subtract({ nanoseconds: 1 });
      if (Temporal.Instant.compare(leftEnd, aS) >= 0) {
        result.push({
          start: formatZonedInCalendar(aSZdt, calendar),
          end: formatZonedInCalendar(
            leftEnd.toZonedDateTimeISO(bEZdt.timeZoneId),
            calendar,
          ),
        });
      }
    }

    // Right piece: A after B ends
    if (Temporal.Instant.compare(aE, bE) > 0) {
      result.push({
        start: formatZonedInCalendar(
          bE.add({ nanoseconds: 1 }).toZonedDateTimeISO(aEZdt.timeZoneId),
          calendar,
        ),
        end: formatZonedInCalendar(aEZdt, calendar),
      });
    }

    return result;
  } catch {
    return [];
  }
}
