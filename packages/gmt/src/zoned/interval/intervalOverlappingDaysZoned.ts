import { Temporal } from "@js-temporal/polyfill";
import {
  calendarOfAllZonedValues,
  countZonedLocalDates,
  halfOpenIntersection,
  parseCalendarZonedValue,
} from "../../internal";
import { isValidCalendarZonedDateTime } from "../validate";

/**
 * Return how many distinct calendar dates two zoned intervals share, counted in the
 * first interval's zone.
 *
 * - Counts the local dates that hold at least one instant of the half-open intersection
 *   `[max(aStart, bStart), min(aEnd, bEnd))`. The end is excluded, so an intersection ending at
 *   local midnight does not touch the date that midnight starts.
 * - `aEnd`, `bStart`, and `bEnd` are re-expressed in `aStart`'s time zone before comparing —
 *   Temporal refuses to compute day-granularity differences directly across two zones, since
 *   day length varies with DST/offset changes. As a result this function is NOT commutative:
 *   swapping the two intervals can change the answer when their zones differ.
 * - Each instant in the intersection contributes its own local date, and each date counts once.
 *   A date the zone deleted is not counted, because no instant has it (`Pacific/Apia` skipped
 *   2011-12-30). A fall-back that sends the clock back into the previous date does not lose that
 *   date (`America/Goose_Bay` fell back at 00:01 on 2010-11-07 into 2010-11-06).
 * - Returns `null` when the intersection crosses more than 10,000 zone transitions (the same cap
 *   as `intervalCountZoned`).
 * - Compatibility: before 1.16.0 the count was the calendar difference of the two endpoint dates
 *   plus one, which counts a deleted date and can be 0 or 1 across a fall-back into the previous
 *   date. To get that number, with `start`/`end` the intersection endpoints in `aStart`'s zone:
 *   `diffDate(parseDateFromZoned(start), parseDateFromZoned(end), "days") + 1`.
 * - Returns `0` when the intersection is empty (a well-defined answer, not invalid input): when the
 *   intervals are disjoint, when they touch (e.g. `aEnd` the same instant as `bStart`), or when
 *   either is empty.
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, malformed strings, leap seconds).
 * - Accepts RFC 9557 calendar-annotated zoned strings
 *   (`"2024-02-24T14:30:00-05:00[America/New_York][u-ca=hebrew]"`; E7, issue #152). All four
 *   arguments must name the same calendar (a bare string names `iso8601`): the count is a day
 *   difference, so different calendars return `null`, as Temporal's `until` throws when
 *   `CalendarEquals` is false. Before 1.16.0 the arguments could name different calendars.
 * - Diverges from date-fns's `getOverlappingDaysInIntervals`, which rounds up elapsed
 *   24-hour periods instead of counting calendar dates. To reproduce date-fns's number,
 *   compose `intervalIntersectionZoned` with `intervalCountZoned`:
 *   `const span = intervalIntersectionZoned(aStart, aEnd, bStart, bEnd); span ? intervalCountZoned(span.start, span.end, "day") : 0;`
 * - Compatibility: since 1.16.0 calendar strings are RFC 9557 (ISO digits, the `[u-ca=<id>]`
 *   annotation after the zone, canonical calendar ids); see `isValidCalendarZonedDateTime`.
 *
 * @param aStart ISO 8601 zoned datetime string for the first interval start
 * @param aEnd ISO 8601 zoned datetime string for the first interval end
 * @param bStart ISO 8601 zoned datetime string for the second interval start
 * @param bEnd ISO 8601 zoned datetime string for the second interval end
 * @returns number of shared calendar dates (counted in aStart's zone), `0` when disjoint, or null on invalid input
 *
 * @example intervalOverlappingDaysZoned("2024-03-09T12:00:00-05:00[America/New_York]", "2024-03-11T12:00:00-04:00[America/New_York]", "2024-03-09T12:00:00-05:00[America/New_York]", "2024-03-11T12:00:00-04:00[America/New_York]") // 3 (spring-forward, 47 real hours)
 * @example intervalOverlappingDaysZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-02T00:00:00+00:00[UTC]", "2024-01-02T00:00:00+00:00[UTC]", "2024-01-03T00:00:00+00:00[UTC]") // 0 (touching: no shared instant)
 * @example intervalOverlappingDaysZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-02T00:00:00+00:00[UTC]", "2024-01-01T00:00:00+00:00[UTC]", "2024-01-02T00:00:00+00:00[UTC]") // 1 (the end, 01-02T00:00, is excluded)
 * @example intervalOverlappingDaysZoned("2011-12-29T23:00:00-10:00[Pacific/Apia]", "2011-12-31T01:00:00+14:00[Pacific/Apia]", "2011-12-29T23:00:00-10:00[Pacific/Apia]", "2011-12-31T01:00:00+14:00[Pacific/Apia]") // 2 (2011-12-30 was deleted)
 * @example intervalOverlappingDaysZoned("2010-11-07T00:00:30-03:00[America/Goose_Bay]", "2010-11-06T23:30:00-04:00[America/Goose_Bay]", "2010-11-07T00:00:30-03:00[America/Goose_Bay]", "2010-11-06T23:30:00-04:00[America/Goose_Bay]") // 2 (the clock fell back into 2010-11-06)
 * @example diffDate(parseDateFromZoned("2010-11-07T00:00:30-03:00[America/Goose_Bay]"), parseDateFromZoned("2010-11-06T23:30:00-04:00[America/Goose_Bay]"), "days") + 1 // 0 (pre-1.16.0 count)
 * @example intervalOverlappingDaysZoned("invalid", "2024-06-30T23:59:59+00:00[UTC]", "2024-04-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // null
 */
export function intervalOverlappingDaysZoned(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): number | null {
  // One gate for all four endpoints: `isValidCalendarZonedDateTime` already covers non-strings,
  // empty strings, leap seconds (which Temporal would otherwise silently clamp to :59), unknown
  // zones and a calendar annotation before the zone — and, unlike `isValidZonedDateTime`, accepts
  // RFC 9557 calendar annotations.
  if (
    !isValidCalendarZonedDateTime(aStart) ||
    !isValidCalendarZonedDateTime(aEnd) ||
    !isValidCalendarZonedDateTime(bStart) ||
    !isValidCalendarZonedDateTime(bEnd)
  ) {
    return null;
  }

  // The count is a day difference between two of the endpoints, so all four must name one
  // calendar (TC39 CalendarEquals, which makes ZonedDateTime#until throw across calendars).
  if (calendarOfAllZonedValues([aStart, aEnd, bStart, bEnd]) === null) {
    return null;
  }

  try {
    const aS = parseCalendarZonedValue(aStart);
    // Boundaries are counted in the start's zone, so the others are re-expressed there —
    // Temporal refuses calendar-unit differences across two zones outright.
    const aE = parseCalendarZonedValue(aEnd).withTimeZone(aS.timeZoneId);
    const bS = parseCalendarZonedValue(bStart).withTimeZone(aS.timeZoneId);
    const bE = parseCalendarZonedValue(bEnd).withTimeZone(aS.timeZoneId);

    if (Temporal.ZonedDateTime.compare(aS, aE) > 0) {
      return null;
    }

    if (Temporal.ZonedDateTime.compare(bS, bE) > 0) {
      return null;
    }

    const overlap = halfOpenIntersection(
      { start: aS, end: aE },
      { start: bS, end: bE },
      Temporal.ZonedDateTime.compare,
    );

    if (overlap === null) {
      return 0;
    }

    // An empty intersection [t, t) (an empty interval strictly inside the other) holds no instant,
    // so it holds no date.
    if (Temporal.ZonedDateTime.compare(overlap.start, overlap.end) === 0) {
      return 0;
    }

    // The last instant the half-open intersection holds is one nanosecond before its end, so the
    // closed local-date count runs to there.
    return countZonedLocalDates(
      overlap.start,
      overlap.end.subtract({ nanoseconds: 1 }),
    );
  } catch {
    return null;
  }
}
