import { Temporal } from "@js-temporal/polyfill";
import { parseCalendarZonedValue } from "../../internal";
import { isValidCalendarZonedDateTime } from "../validate";

/**
 * Return how many distinct calendar dates two zoned intervals share, counted in the
 * first interval's zone.
 *
 * - Counts the number of local dates touched by the closed intersection
 *   `[max(aStart, bStart), min(aEnd, bEnd)]` — inclusive of both endpoints.
 * - `aEnd`, `bStart`, and `bEnd` are re-expressed in `aStart`'s time zone before comparing —
 *   Temporal refuses to compute day-granularity differences directly across two zones, since
 *   day length varies with DST/offset changes. As a result this function is NOT commutative:
 *   swapping the two intervals can change the answer when their zones differ.
 * - Zones whose calendar skips a date entirely (e.g. `Pacific/Apia`'s 2011 dateline change)
 *   still count the skipped date — this matches `intervalCountZoned`'s calendar-arithmetic
 *   rule, so the two functions never disagree about what a day is.
 * - Adjacent intervals (e.g. `aEnd === bStart`) share one date and count as `1`.
 * - Returns `0` when the intervals do not overlap at all (a well-defined answer, not
 *   invalid input).
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, malformed strings, leap seconds).
 * - **Accepts mixed calendar systems** (E7's D4-zoned, issue #152): both bare ISO zoned strings
 *   and GMT calendar-annotated ones (`"5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]"`),
 *   and the two endpoints need not agree on a calendar. Ordering is calendar-independent —
 *   verified that `Temporal.Instant` carries no calendar field at all and that
 *   `Instant.compare`/`ZonedDateTime.compare` both return `0` for the same instant expressed in
 *   hebrew, islamic-civil, japanese and iso8601.
 * - Still rejects Temporal's own `[timeZone][u-ca=...]` RFC 9557 ordering, which reads GMT's
 *   calendar-native digits as ISO digits — see `regex/calendar-zoned-date-time.ts`.
 * - Diverges from date-fns's `getOverlappingDaysInIntervals`, which rounds up elapsed
 *   24-hour periods instead of counting calendar dates. To reproduce date-fns's number,
 *   compose `intervalIntersectionZoned` with `intervalCountZoned`:
 *   `const span = intervalIntersectionZoned(aStart, aEnd, bStart, bEnd); span ? intervalCountZoned(span.start, span.end, "day") : 0;`
 *
 * @param aStart ISO 8601 zoned datetime string for the first interval start
 * @param aEnd ISO 8601 zoned datetime string for the first interval end
 * @param bStart ISO 8601 zoned datetime string for the second interval start
 * @param bEnd ISO 8601 zoned datetime string for the second interval end
 * @returns number of shared calendar dates (counted in aStart's zone), `0` when disjoint, or null on invalid input
 *
 * @example intervalOverlappingDaysZoned("2024-03-09T12:00:00-05:00[America/New_York]", "2024-03-11T12:00:00-04:00[America/New_York]", "2024-03-09T12:00:00-05:00[America/New_York]", "2024-03-11T12:00:00-04:00[America/New_York]") // 3 (spring-forward, 47 real hours)
 * @example intervalOverlappingDaysZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-02T00:00:00+00:00[UTC]", "2024-01-03T00:00:00+00:00[UTC]", "2024-01-04T00:00:00+00:00[UTC]") // 0 (disjoint)
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
  // zones and Temporal's forbidden segment ordering — and, unlike `isValidZonedDateTime`, accepts
  // GMT's calendar-annotated grammar.
  if (
    !isValidCalendarZonedDateTime(aStart) ||
    !isValidCalendarZonedDateTime(aEnd) ||
    !isValidCalendarZonedDateTime(bStart) ||
    !isValidCalendarZonedDateTime(bEnd)
  ) {
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

    if (
      Temporal.ZonedDateTime.compare(aE, bS) < 0 ||
      Temporal.ZonedDateTime.compare(bE, aS) < 0
    ) {
      return 0;
    }

    const start = Temporal.ZonedDateTime.compare(aS, bS) >= 0 ? aS : bS;
    const end = Temporal.ZonedDateTime.compare(aE, bE) <= 0 ? aE : bE;
    // Both operands are normalized to iso8601 immediately before `.until()`. `.compare` above is
    // calendar-independent, but `PlainDate.prototype.until` is NOT — it throws
    // `RangeError: cannot compute difference between dates of hebrew and iso8601 calendars`
    // whenever the two endpoints came from different calendars, which this function explicitly
    // accepts (E7's D4-zoned). Counting distinct calendar DATES is a Gregorian/ISO question
    // regardless of how either endpoint was tagged, so normalizing is the right answer, not just
    // the safe one. Exactly the same hazard `intervalOverlappingDaysDate` hit in E5 (finding 2).
    const startDate = start.toPlainDate().withCalendar("iso8601");
    const endDate = end.toPlainDate().withCalendar("iso8601");

    return startDate.until(endDate, { largestUnit: "day" }).days + 1;
  } catch {
    return null;
  }
}
