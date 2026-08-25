import { Temporal } from "@js-temporal/polyfill";
import { parseCalendarZonedValue } from "../../internal";
import { isValidCalendarZonedDateTime } from "../validate";

/**
 * Return true when two zoned intervals are exactly adjacent — one's end equals the other's
 * start with zero gap and zero overlap.
 *
 * - Uses `Temporal.Instant.compare` for comparison (via `.toInstant()`).
 * - Returns `true` when `aEnd + 1 nanosecond === bStart` or `bEnd + 1 nanosecond === aStart`.
 * - Returns `false` when intervals overlap, are disjoint with a gap, or are invalid.
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
 * @param aStart ISO 8601 zoned datetime string for the first interval start
 * @param aEnd ISO 8601 zoned datetime string for the first interval end
 * @param bStart ISO 8601 zoned datetime string for the second interval start
 * @param bEnd ISO 8601 zoned datetime string for the second interval end
 * @returns true if intervals are exactly adjacent, or false on invalid input
 *
 * @example intervalAbutsZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-06-30T12:00:00+00:00[UTC]", "2024-06-30T12:00:00.000000001+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]") // true
 * @example intervalAbutsZoned("2024-06-30T12:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]", "2024-01-01T09:00:00+00:00[UTC]", "2024-06-30T12:00:00.000000001+00:00[UTC]") // true
 * @example intervalAbutsZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-06-30T12:00:00+00:00[UTC]", "2024-06-30T12:00:01+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]") // false (gap)
 * @example intervalAbutsZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-06-30T13:00:00+00:00[UTC]", "2024-06-30T12:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]") // false (overlap)
 * @example intervalAbutsZoned("invalid", "2024-06-30T12:00:00+00:00[UTC]", "2024-06-30T12:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]") // false
 */
export function intervalAbutsZoned(
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

    // aEnd + 1 nanosecond === bStart
    const aEndPlusOne = aE.add({ nanoseconds: 1 });
    if (Temporal.Instant.compare(aEndPlusOne, bS) === 0) {
      return true;
    }

    // bEnd + 1 nanosecond === aStart
    const bEndPlusOne = bE.add({ nanoseconds: 1 });
    if (Temporal.Instant.compare(bEndPlusOne, aS) === 0) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
