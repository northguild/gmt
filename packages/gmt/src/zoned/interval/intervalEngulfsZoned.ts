// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { halfOpenContainsSpan, parseCalendarZonedValue } from "../../internal";
import { isValidCalendarZonedDateTime } from "../validate";

/**
 * Return true when the half-open interval B `[bStart, bEnd)` lies within the half-open interval
 * A `[aStart, aEnd)` — every instant of B falls within A.
 *
 * - Uses `Temporal.Instant.compare` for comparison (via `.toInstant()`).
 * - B is inside A when the intervals overlap and `aStart <= bStart` and `bEnd <= aEnd` by
 *   instant. Both ends are exclusive, so B may start at A's start and end at A's end.
 * - An empty B counts only strictly inside A, the same edge rule as `clampInterval`; at either edge
 *   of A it returns `false`, and an empty A engulfs nothing.
 * - Equivalent to 4-argument `intervalContainsZoned(aStart, aEnd, bStart, bEnd)`.
 * - Returns `false` if either interval is invalid (`start > end`).
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

    // B overlaps A, and B's start and exclusive end both lie within A's bounds.
    return halfOpenContainsSpan(
      { start: aS, end: aE },
      { start: bS, end: bE },
      Temporal.Instant.compare,
    );
  } catch {
    return false;
  }
}
