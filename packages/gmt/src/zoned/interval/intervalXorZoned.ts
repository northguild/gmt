import { Temporal } from "@js-temporal/polyfill";
import {
  calendarOfAllZonedValues,
  formatZonedInCalendar,
  parseCalendarZonedValue,
} from "../../internal";
import { isValidCalendarZonedDateTime } from "../validate";

/**
 * Return the symmetric difference of two zoned intervals — time covered by exactly one interval.
 *
 * - Uses `Temporal.Instant.compare` for comparison (via `.toInstant()`).
 * - Returns `[]` when intervals are identical or both invalid.
 * - Returns `[{ start, end }]` when the intervals share exactly one boundary — one starts (or
 *   ends) precisely where the other ends (or starts), so only one remainder piece exists.
 * - Returns `[{ start, end }, { start, end }]` when intervals partially overlap, and also when
 *   one interval strictly contains the other (the piece before B and the piece after B).
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
 * @returns array of `{ start, end }` records representing the symmetric difference, or `[]` on invalid input
 *
 * @example intervalXorZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-06-30T12:00:00+00:00[UTC]", "2024-04-01T11:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]") // partial overlap — [{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-04-01T10:59:59.999999999+00:00[UTC]" }, { start: "2024-06-30T12:00:00.000000001+00:00[UTC]", end: "2024-12-31T17:00:00+00:00[UTC]" }]
 * @example intervalXorZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]", "2024-02-01T08:00:00+00:00[UTC]", "2024-03-01T10:00:00+00:00[UTC]") // B strictly inside A — two remainder pieces — [{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-02-01T07:59:59.999999999+00:00[UTC]" }, { start: "2024-03-01T10:00:00.000000001+00:00[UTC]", end: "2024-12-31T17:00:00+00:00[UTC]" }]
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

    // If intervals don't overlap, return both as-is
    if (
      Temporal.Instant.compare(aE, bS) < 0 ||
      Temporal.Instant.compare(bE, aS) < 0
    ) {
      return [
        {
          start: formatZonedInCalendar(aSZdt, calendar),
          end: formatZonedInCalendar(aEZdt, calendar),
        },
        {
          start: formatZonedInCalendar(bSZdt, calendar),
          end: formatZonedInCalendar(bEZdt, calendar),
        },
      ];
    }

    // Left piece: A before B starts
    if (Temporal.Instant.compare(aS, bS) < 0) {
      result.push({
        start: formatZonedInCalendar(aSZdt, calendar),
        end: formatZonedInCalendar(
          bS.subtract({ nanoseconds: 1 }).toZonedDateTimeISO(aEZdt.timeZoneId),
          calendar,
        ),
      });
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

    // Left piece: B before A starts
    if (Temporal.Instant.compare(bS, aS) < 0) {
      result.push({
        start: formatZonedInCalendar(bSZdt, calendar),
        end: formatZonedInCalendar(
          aS.subtract({ nanoseconds: 1 }).toZonedDateTimeISO(bEZdt.timeZoneId),
          calendar,
        ),
      });
    }

    // Right piece: B after A ends
    if (Temporal.Instant.compare(bE, aE) > 0) {
      result.push({
        start: formatZonedInCalendar(
          aE.add({ nanoseconds: 1 }).toZonedDateTimeISO(bEZdt.timeZoneId),
          calendar,
        ),
        end: formatZonedInCalendar(bEZdt, calendar),
      });
    }

    return result;
  } catch {
    return [];
  }
}
