import { Temporal } from "@js-temporal/polyfill";
import { parseCalendarZonedValue } from "../../internal";
import { isValidCalendarZonedDateTime } from "../validate";

/**
 * Return true when interval B is fully contained within interval A — every instant of B
 * falls within A.
 *
 * - Uses `Temporal.Instant.compare` for comparison (via `.toInstant()`).
 * - Equivalent to 4-argument `intervalContainsZoned(aStart, aEnd, bStart, bEnd)`.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input (wrong type, malformed strings, leap seconds).
 * - **Accepts mixed calendar systems** (E7's D4-zoned, issue #152): both bare ISO zoned strings
 *   and GMT calendar-annotated ones (`"5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]"`),
 *   and the two endpoints need not agree on a calendar. Ordering is calendar-independent —
 *   verified that `Temporal.Instant` carries no calendar field at all and that
 *   `Instant.compare`/`ZonedDateTime.compare` both return `0` for the same instant expressed in
 *   hebrew, islamic-civil, japanese and iso8601.
 * - Still rejects Temporal's own `[timeZone][u-ca=...]` RFC 9557 ordering, which reads GMT's
 *   calendar-native digits as ISO digits — see `regex/calendar-zoned-date-time.ts`.
 *
 * @param aStart ISO 8601 zoned datetime string for the outer interval start
 * @param aEnd ISO 8601 zoned datetime string for the outer interval end
 * @param bStart ISO 8601 zoned datetime string for the inner interval start
 * @param bEnd ISO 8601 zoned datetime string for the inner interval end
 * @returns true if B is fully contained in A, or false on invalid input
 *
 * @example intervalEngulfsZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]", "2024-06-01T12:00:00+00:00[UTC]", "2024-07-01T13:00:00+00:00[UTC]") // true
 * @example intervalEngulfsZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]", "2024-01-01T09:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]") // true (equal intervals)
 * @example intervalEngulfsZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]", "2024-01-01T09:00:00+00:00[UTC]", "2024-06-30T12:00:00+00:00[UTC]") // true
 * @example intervalEngulfsZoned("2024-06-01T12:00:00+00:00[UTC]", "2024-07-01T13:00:00+00:00[UTC]", "2024-01-01T09:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]") // false
 * @example intervalEngulfsZoned("invalid", "2024-12-31T17:00:00+00:00[UTC]", "2024-06-01T12:00:00+00:00[UTC]", "2024-07-01T13:00:00+00:00[UTC]") // false
 */
export function intervalEngulfsZoned(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
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
    return false;
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
      return false;
    }

    if (Temporal.Instant.compare(bS, bE) > 0) {
      return false;
    }

    return (
      Temporal.Instant.compare(aS, bS) <= 0 &&
      Temporal.Instant.compare(bE, aE) <= 0
    );
  } catch {
    return false;
  }
}
