// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import {
  countZonedBuckets,
  parseCalendarZonedPairForArithmetic,
  resolveDateTimeUnit,
} from "../../internal";
import { isValidDateTimeUnit } from "../../plain/validate";
import { isValidCalendarZonedDateTime } from "../validate/isValidCalendarZonedDateTime";

/**
 * Count how many `unit` boundaries a zoned interval crosses.
 *
 * - Counts local calendar boundaries touched by the half-open interval `[start, end)` —
 *   distinct from `diffZoned`, which measures exact elapsed duration.
 * - The end boundary is excluded: midnight to midnight two days later counts 2 days.
 * - A zero-length interval (`start === end`) returns `0`: the empty `[start, start)` holds no instant,
 *   so it touches no unit (before 1.16.0 it counted 1 when mid-unit).
 * - DST-aware: a local day that springs forward counts 23 hour boundaries and one that falls
 *   back counts 25. A local day whose midnight is skipped entirely starts at 01:00.
 * - A fixed 24-hour span touches 25 local hour boundaries in zones offset by :30/:45.
 * - Counts the real local buckets `floorToZone`/`bucketRange` walk: a bucket shorter than its
 *   unit still counts once (`Pacific/Chatham`'s 15-minute 03:00 hour on its spring-forward),
 *   and a local day the zone deleted counts not at all (`Pacific/Apia`'s 2011-12-30).
 * - The count equals `bucketRange(...).length` wherever `bucketRange` is within its 10,000-bucket
 *   cap. Counting has its own, separate cap of 10,000 zone transitions, so it keeps answering past
 *   `bucketRange`'s: two years by hour counts 17,544 while `bucketRange` returns `[]`.
 * - Returns `null` when the span crosses more than 10,000 zone transitions.
 * - When `start` and `end` carry different time zones, boundaries are counted in `start`'s zone.
 * - Weeks start on Monday (ISO 8601).
 * - Accepts singular or plural units (`"day"` and `"days"` behave identically).
 * - Accepts RFC 9557 calendar-annotated zoned strings (as produced by `convertZonedToCalendar`) as
 *   well as bare ISO ones — E7 (issue #152). When BOTH endpoints carry the same calendar tag the
 *   measurement is made in that calendar. When they name different calendars (a bare ISO string
 *   names `iso8601`) the result is `null` in every unit, `"hour"` included, as
 *   `ZonedDateTime.prototype.until` throws when TC39 `CalendarEquals` is false (before 1.16.0 it
 *   was measured in ISO).
 * - Returns `null` on invalid input (unparseable start/end, `start > end`, unsupported unit,
 *   leap-second strings).
 * - Compatibility: since 1.16.0 calendar strings are RFC 9557 (ISO digits, the `[u-ca=<id>]`
 *   annotation after the zone, canonical calendar ids); see `isValidCalendarZonedDateTime`.
 *
 * @param start ISO 8601 zoned datetime string for the interval start
 * @param end ISO 8601 zoned datetime string for the interval end
 * @param unit unit string — any `DateTimeUnit`
 * @returns number of unit boundaries touched, or null on invalid input
 *
 * @example intervalCountZoned("2024-01-01T23:59:00+00:00[UTC]", "2024-01-02T00:01:00+00:00[UTC]", "day") // 2
 * @example intervalCountZoned("2024-03-10T00:00:00-05:00[America/New_York]", "2024-03-11T00:00:00-04:00[America/New_York]", "hour") // 23 (spring forward)
 * @example intervalCountZoned("2024-11-03T00:00:00-04:00[America/New_York]", "2024-11-04T00:00:00-05:00[America/New_York]", "hour") // 25 (fall back)
 * @example intervalCountZoned("2024-01-01T00:00:00-05:00[America/New_York]", "2024-01-03T00:00:00+09:00[Asia/Tokyo]", "day") // 2 (counted in America/New_York)
 * @example intervalCountZoned("2024-01-01T05:00:00+00:00[UTC]", "2024-01-01T05:00:00+00:00[UTC]", "day") // 0 (zero-length: holds no instant)
 * @example intervalCountZoned("2023-09-16T00:00:00-04:00[America/New_York][u-ca=hebrew]", "2024-10-03T00:00:00-04:00[America/New_York][u-ca=hebrew]", "month") // 13 (Hebrew leap year; the ISO equivalent is 14)
 * @example intervalCountZoned("invalid", "2024-01-02T00:00:00+00:00[UTC]", "day") // null
 * @example intervalCountZoned("-271821-04-20T00:00:00+00:00[UTC]", "-271821-04-20T01:00:00+00:00[UTC]", "week") // 1 (the week began before the first instant, but is still touched)
 */
export function intervalCountZoned(
  start: string,
  end: string,
  unit: string,
): number | null {
  if (
    !isValidCalendarZonedDateTime(start) ||
    !isValidCalendarZonedDateTime(end)
  ) {
    return null;
  }

  if (typeof unit !== "string") {
    return null;
  }

  const resolvedUnit = resolveDateTimeUnit(unit);

  if (!isValidDateTimeUnit(resolvedUnit)) {
    return null;
  }

  try {
    // The pair is resolved BEFORE either endpoint reaches `countZonedBuckets`: a pair naming
    // different calendars throws here (TC39 CalendarEquals) and returns the sentinel.
    const { a: startVal, b: pairedEnd } = parseCalendarZonedPairForArithmetic(
      start,
      end,
    );
    // Boundaries are counted in the start's zone, so the end is re-expressed there.
    // Temporal refuses calendar-unit differences across two zones outright. `withTimeZone`
    // preserves the calendar tag (verified), so this does not undo the pair normalization above.
    const endVal = pairedEnd.withTimeZone(startVal.timeZoneId);

    const order = Temporal.ZonedDateTime.compare(startVal, endVal);

    if (order > 0) {
      return null;
    }

    // An empty interval [t, t) holds no instant, so it touches no unit (CORE-6 empty-interval rule).
    if (order === 0) {
      return 0;
    }

    // The walker keeps the pair's calendar, so a Hebrew month or year is counted in Hebrew
    // months or years, and it compares instants, never calendar-sensitive `.equals()`.
    return countZonedBuckets(startVal, endVal, resolvedUnit);
  } catch {
    return null;
  }
}
