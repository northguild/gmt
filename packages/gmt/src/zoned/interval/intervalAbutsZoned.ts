// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { halfOpenAbuts, parseCalendarZonedValue } from "../../internal";
import { isValidCalendarZonedDateTime } from "../validate";

/**
 * Return true when two half-open zoned intervals `[start, end)` are exactly adjacent — one ends at
 * the instant the other starts, so they share no instant and leave no gap (Allen's "meets", either
 * order).
 *
 * - Uses `Temporal.Instant.compare` for comparison (via `.toInstant()`), so the shared instant may
 *   be spelled in different zones.
 * - Returns `true` when `aEnd` is the same instant as `bStart`, or `bEnd` the same instant as
 *   `aStart`, and neither interval is empty. No instant is stepped by a nanosecond, so an interval
 *   ending at the last representable instant is handled like any other.
 * - Returns `false` when intervals overlap, are disjoint with a gap (even one nanosecond), are
 *   invalid, or when either is empty (`start` and `end` the same instant): an empty interval abuts
 *   nothing.
 * - Returns `false` on invalid input (wrong type, malformed strings, leap seconds).
 * - **Accepts mixed calendar systems** (E7's D4-zoned, issue #152): both bare ISO zoned strings
 *   and RFC 9557 calendar-annotated ones (`"2024-02-24T14:30:00-05:00[America/New_York][u-ca=hebrew]"`),
 *   and the two endpoints need not agree on a calendar. Ordering is calendar-independent —
 *   verified that `Temporal.Instant` carries no calendar field at all and that
 *   `Instant.compare`/`ZonedDateTime.compare` both return `0` for the same instant expressed in
 *   hebrew, islamic-civil, japanese and iso8601.
 * - Rejects a calendar annotation before the time zone annotation, which is not RFC 9557.
 * - Compatibility: since 1.16.0 calendar strings are RFC 9557 (ISO digits, the `[u-ca=<id>]`
 *   annotation after the zone, canonical calendar ids); see `isValidCalendarZonedDateTime`.
 *
 * @param aStart ISO 8601 zoned datetime string for the first interval start
 * @param aEnd ISO 8601 zoned datetime string for the first interval end
 * @param bStart ISO 8601 zoned datetime string for the second interval start
 * @param bEnd ISO 8601 zoned datetime string for the second interval end
 * @returns true if intervals are exactly adjacent, or false on invalid input
 *
 * @example intervalAbutsZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-06-30T12:00:00+00:00[UTC]", "2024-06-30T12:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]") // true
 * @example intervalAbutsZoned("2024-06-30T12:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]", "2024-01-01T09:00:00+00:00[UTC]", "2024-06-30T08:00:00-04:00[America/New_York]") // true (the same instant in another zone)
 * @example intervalAbutsZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-06-30T12:00:00+00:00[UTC]", "2024-06-30T12:00:00.000000001+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]") // false (one-nanosecond gap)
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
  // zones and a calendar annotation before the zone — and, unlike `isValidZonedDateTime`, accepts
  // RFC 9557 calendar annotations.
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

    // aEnd is bStart, or bEnd is aStart, between two non-empty intervals.
    return halfOpenAbuts(
      { start: aS, end: aE },
      { start: bS, end: bE },
      Temporal.Instant.compare,
    );
  } catch {
    return false;
  }
}
