import { Temporal } from "@js-temporal/polyfill";
import {
  getStartOfZonedUnit,
  getUnitSpan,
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
 * - A zero-length interval counts 1 when it sits mid-unit and 0 when it sits exactly on a
 *   unit boundary.
 * - DST-aware: a local day that springs forward counts 23 hour boundaries and one that falls
 *   back counts 25. A local day whose midnight is skipped entirely starts at 01:00.
 * - A fixed 24-hour span touches 25 local hour boundaries in zones offset by :30/:45.
 * - When `start` and `end` carry different time zones, boundaries are counted in `start`'s zone.
 * - Weeks start on Monday (ISO 8601).
 * - Accepts singular or plural units (`"day"` and `"days"` behave identically).
 * - Accepts GMT calendar-annotated zoned strings (as produced by `convertZonedToCalendar`) as
 *   well as bare ISO ones — E7 (issue #152). When BOTH endpoints carry the same calendar tag the
 *   measurement is made in that calendar; when the tags mismatch, or either endpoint is bare ISO,
 *   it falls back to Gregorian/ISO rather than returning the sentinel (E7's D5-zoned). The
 *   fallback is mandatory, not a convenience: `ZonedDateTime.prototype.until` throws across
 *   mismatched calendars for EVERY `largestUnit` — verified, including `"hour"` and
 *   `"nanosecond"`.
 * - Returns `null` on invalid input (unparseable start/end, `start > end`, unsupported unit,
 *   leap-second strings).
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
 * @example intervalCountZoned("2024-01-01T05:00:00+00:00[UTC]", "2024-01-01T05:00:00+00:00[UTC]", "day") // 1 (zero-length, mid-day)
 * @example intervalCountZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-01T00:00:00+00:00[UTC]", "day") // 0 (zero-length, on the boundary)
 * @example intervalCountZoned("5784-01-01T00:00:00-04:00[u-ca=hebrew][America/New_York]", "5785-01-01T00:00:00-04:00[u-ca=hebrew][America/New_York]", "month") // 13 (Hebrew leap year; the ISO equivalent is 14)
 * @example intervalCountZoned("invalid", "2024-01-02T00:00:00+00:00[UTC]", "day") // null
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
    // The pair is resolved BEFORE either endpoint reaches `getStartOfZonedUnit`. Normalizing only
    // one side would leave `startOfStart.until(startOfEnd)` throwing on a mismatched pair
    // (verified), so the D5 policy has to be applied to both operands together, up front.
    const { a: startVal, b: pairedEnd } = parseCalendarZonedPairForArithmetic(
      start,
      end,
    );
    // Boundaries are counted in the start's zone, so the end is re-expressed there.
    // Temporal refuses calendar-unit differences across two zones outright. `withTimeZone`
    // preserves the calendar tag (verified), so this does not undo the pair normalization above.
    const endVal = pairedEnd.withTimeZone(startVal.timeZoneId);

    if (Temporal.ZonedDateTime.compare(startVal, endVal) > 0) {
      return null;
    }

    const startOfStart = getStartOfZonedUnit(startVal, resolvedUnit);
    const startOfEnd = getStartOfZonedUnit(endVal, resolvedUnit);

    const spanned = getUnitSpan(
      startOfStart.until(startOfEnd, { largestUnit: resolvedUnit }),
      resolvedUnit,
    );

    // `.equals()` here IS calendar-sensitive — it is `ZonedDateTime.prototype.equals`, and
    // `iso.equals(heb)` is `false` even at the same instant (verified). It is safe only by
    // construction: `startOfEnd` is derived from `endVal` one line above
    // (`getStartOfZonedUnit(endVal, resolvedUnit)`), so the two always share `endVal`'s calendar
    // by definition of how `startOfEnd` is built. A refactor that hoists `endVal` out, or that
    // sources `startOfEnd` from anywhere but `endVal`, breaks this silently — compare instants
    // (or re-derive `startOfEnd` from `endVal`) if that ever happens.
    return spanned + (startOfEnd.equals(endVal) ? 0 : 1);
  } catch {
    return null;
  }
}
