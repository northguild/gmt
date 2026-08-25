import { Temporal } from "@js-temporal/polyfill";
import { parseCalendarZonedValue } from "../../internal";
import { isValidCalendarZonedDateTime } from "../validate";

/**
 * Return true when `pointOrStart` falls within the interval `[intervalStart, intervalEnd]`
 * (3-arg), or when the inner interval `[innerStart, innerEnd]` is fully contained within
 * the outer interval `[intervalStart, intervalEnd]` (4-arg).
 *
 * - Uses `Temporal.Instant.compare` for comparison (same instant semantics).
 * - Always-inclusive boundaries: `start <= point <= end`.
 * - Returns `false` if `intervalStart > intervalEnd` (invalid outer interval).
 * - Returns `false` if `innerStart > innerEnd` in 4-arg mode (invalid inner interval).
 * - Returns `false` on invalid input (wrong type, malformed strings, leap seconds).
 * - **Accepts mixed calendar systems** (E7's D4-zoned, issue #152): both bare ISO zoned strings
 *   and GMT calendar-annotated ones (`"5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]"`),
 *   and the endpoints need not agree on a calendar. Ordering is calendar-independent — verified
 *   that `Temporal.Instant` carries no calendar field at all and that
 *   `Instant.compare`/`ZonedDateTime.compare` both return `0` for the same instant expressed in
 *   hebrew, islamic-civil, japanese and iso8601.
 * - Still rejects Temporal's own `[timeZone][u-ca=...]` RFC 9557 ordering, which reads GMT's
 *   calendar-native digits as ISO digits — see `regex/calendar-zoned-date-time.ts`.
 *
 * @param intervalStart ISO 8601 zoned datetime string for the outer interval start
 * @param intervalEnd ISO 8601 zoned datetime string for the outer interval end
 * @param pointOrStart ISO 8601 zoned datetime string for the point (3-arg) or inner start (4-arg)
 * @param pointEnd optional ISO 8601 zoned datetime string for the inner interval end (4-arg mode)
 * @returns true if the point or inner interval is contained, or false on invalid input
 *
 * @example intervalContainsZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]", "2024-06-15T12:00:00+00:00[UTC]") // true
 * @example intervalContainsZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]", "2024-06-15T12:00:00+00:00[UTC]", "2024-07-15T12:00:00+00:00[UTC]") // true
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
  // and Temporal's forbidden segment ordering — and, unlike `isValidZonedDateTime`, accepts GMT's
  // calendar-annotated grammar. `pointEnd` is optional, so it is only checked when supplied.
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

    if (pointEnd === undefined) {
      return (
        Temporal.Instant.compare(startInstant, pointInstant) <= 0 &&
        Temporal.Instant.compare(pointInstant, endInstant) <= 0
      );
    }

    const endPointZdt = parseCalendarZonedValue(pointEnd);
    const endPointInstant = endPointZdt.toInstant();

    if (Temporal.Instant.compare(pointInstant, endPointInstant) > 0) {
      return false;
    }

    return (
      Temporal.Instant.compare(startInstant, pointInstant) <= 0 &&
      Temporal.Instant.compare(endPointInstant, endInstant) <= 0
    );
  } catch {
    return false;
  }
}
