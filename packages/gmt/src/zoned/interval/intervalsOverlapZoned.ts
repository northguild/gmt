import { Temporal } from "@js-temporal/polyfill";
import { parseCalendarZonedValue } from "../../internal";
import { isValidCalendarZonedDateTime } from "../validate";

/**
 * Return true when intervals `[aStart, aEnd]` and `[bStart, bEnd]` share at least one instant.
 *
 * - Uses `Temporal.Instant.compare` for comparison (same instant semantics).
 * - Adjacent intervals (e.g. `aEnd === bStart`) do NOT overlap — returns `false`.
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
 * @param aStart ISO 8601 zoned datetime string for the first interval start
 * @param aEnd ISO 8601 zoned datetime string for the first interval end
 * @param bStart ISO 8601 zoned datetime string for the second interval start
 * @param bEnd ISO 8601 zoned datetime string for the second interval end
 * @returns true if intervals overlap, or false on invalid input
 *
 * @example intervalsOverlapZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-06-30T23:59:59+00:00[UTC]", "2024-04-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // true
 * @example intervalsOverlapZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-06-30T23:59:59+00:00[UTC]", "2024-07-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // false (adjacent)
 * @example intervalsOverlapZoned("invalid", "2024-06-30T23:59:59+00:00[UTC]", "2024-04-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // false
 */
export function intervalsOverlapZoned(
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
    const aZdt = parseCalendarZonedValue(aStart);
    const aZde = parseCalendarZonedValue(aEnd);
    const bZdt = parseCalendarZonedValue(bStart);
    const bZde = parseCalendarZonedValue(bEnd);

    const aSI = aZdt.toInstant();
    const aEI = aZde.toInstant();
    const bSI = bZdt.toInstant();
    const bEI = bZde.toInstant();

    if (Temporal.Instant.compare(aSI, aEI) > 0) {
      return false;
    }

    if (Temporal.Instant.compare(bSI, bEI) > 0) {
      return false;
    }

    return (
      Temporal.Instant.compare(aEI, bSI) >= 0 &&
      Temporal.Instant.compare(bEI, aSI) >= 0
    );
  } catch {
    return false;
  }
}
