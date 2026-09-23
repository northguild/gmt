import { Temporal } from "@js-temporal/polyfill";
import {
  halfOpenContainsPoint,
  halfOpenContainsSpan,
  parseCalendarZonedValue,
} from "../../internal";
import { isValidCalendarZonedDateTime } from "../validate";

/**
 * Return true when `pointOrStart` falls within the half-open interval
 * `[intervalStart, intervalEnd)` (3-arg), or when the inner interval `[innerStart, innerEnd)` lies
 * within the outer interval `[intervalStart, intervalEnd)` (4-arg).
 *
 * - Uses `Temporal.Instant.compare` for comparison (same instant semantics).
 * - Point mode: `start <= point < end`, the same rule as `intervalContains`. The `end` is
 *   excluded, so a point at `end`'s instant returns `false`, and an empty interval (`start` and
 *   `end` the same instant) contains no point.
 * - Interval mode: the intervals overlap and `start <= innerStart` and `innerEnd <= end`. An inner
 *   interval may share the outer `end`. An empty inner interval counts only strictly inside the
 *   outer interval, the same edge rule as `clampInterval`, and an empty outer interval contains
 *   nothing.
 * - Returns `false` if `intervalStart > intervalEnd` (invalid outer interval).
 * - Returns `false` if `innerStart > innerEnd` in 4-arg mode (invalid inner interval).
 * - Returns `false` on invalid input (wrong type, malformed strings, leap seconds).
 * - **Accepts mixed calendar systems** (E7's D4-zoned, issue #152): both bare ISO zoned strings
 *   and RFC 9557 calendar-annotated ones (`"2024-02-24T14:30:00-05:00[America/New_York][u-ca=hebrew]"`),
 *   and the endpoints need not agree on a calendar. Ordering is calendar-independent — verified
 *   that `Temporal.Instant` carries no calendar field at all and that
 *   `Instant.compare`/`ZonedDateTime.compare` both return `0` for the same instant expressed in
 *   hebrew, islamic-civil, japanese and iso8601.
 * - Rejects a calendar annotation before the time zone annotation, which is not RFC 9557.
 * - Compatibility: since 1.16.0 calendar strings are RFC 9557 (ISO digits, the `[u-ca=<id>]`
 *   annotation after the zone, canonical calendar ids); see `isValidCalendarZonedDateTime`.
 *
 * @param intervalStart ISO 8601 zoned datetime string for the outer interval start
 * @param intervalEnd ISO 8601 zoned datetime string for the outer interval end
 * @param pointOrStart ISO 8601 zoned datetime string for the point (3-arg) or inner start (4-arg)
 * @param pointEnd optional ISO 8601 zoned datetime string for the inner interval end (4-arg mode)
 * @returns true if the point or inner interval is contained, or false on invalid input
 *
 * @example intervalContainsZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]", "2024-06-15T12:00:00+00:00[UTC]") // true
 * @example intervalContainsZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]", "2024-06-15T12:00:00+00:00[UTC]", "2024-07-15T12:00:00+00:00[UTC]") // true
 * @example intervalContainsZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-01-01T12:00:00+00:00[UTC]", "2024-01-01T12:00:00+00:00[UTC]") // false (the end is excluded)
 * @example intervalContainsZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-01-01T17:00:00+00:00[UTC]", "2024-01-01T12:00:00+00:00[UTC]", "2024-01-01T17:00:00+00:00[UTC]") // true (the inner interval shares the end)
 * @example intervalContainsZoned("2024-12-31T23:59:59+00:00[UTC]", "2024-01-01T00:00:00+00:00[UTC]", "2024-06-15T12:00:00+00:00[UTC]") // false
 * @example intervalContainsZoned("invalid", "2024-12-31T23:59:59+00:00[UTC]", "2024-06-15T12:00:00+00:00[UTC]") // false
 */
export function intervalContainsZoned(
  intervalStart: string,
  intervalEnd: string,
  pointOrStart: string,
  pointEnd?: string,
): boolean {
  // One gate per endpoint: `isValidCalendarZonedDateTime` already covers non-strings, empty
  // strings, leap seconds (which Temporal would otherwise silently clamp to :59), unknown zones
  // and a calendar annotation before the zone — and, unlike `isValidZonedDateTime`, accepts
  // RFC 9557 calendar annotations. `pointEnd` is optional, so it is only checked when supplied.
  if (
    !isValidCalendarZonedDateTime(intervalStart) ||
    !isValidCalendarZonedDateTime(intervalEnd) ||
    !isValidCalendarZonedDateTime(pointOrStart) ||
    (pointEnd !== undefined && !isValidCalendarZonedDateTime(pointEnd))
  ) {
    return false;
  }

  try {
    const startZdt = parseCalendarZonedValue(intervalStart);
    const endZdt = parseCalendarZonedValue(intervalEnd);
    const pointZdt = parseCalendarZonedValue(pointOrStart);

    const startInstant = startZdt.toInstant();
    const endInstant = endZdt.toInstant();
    const pointInstant = pointZdt.toInstant();

    if (Temporal.Instant.compare(startInstant, endInstant) > 0) {
      return false;
    }

    const outer = { start: startInstant, end: endInstant };

    if (pointEnd === undefined) {
      return halfOpenContainsPoint(
        outer,
        pointInstant,
        Temporal.Instant.compare,
      );
    }

    const endPointZdt = parseCalendarZonedValue(pointEnd);
    const endPointInstant = endPointZdt.toInstant();

    if (Temporal.Instant.compare(pointInstant, endPointInstant) > 0) {
      return false;
    }

    return halfOpenContainsSpan(
      outer,
      { start: pointInstant, end: endPointInstant },
      Temporal.Instant.compare,
    );
  } catch {
    return false;
  }
}
