// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { halfOpenOverlap, parseCalendarZonedValue } from "../../internal";
import { isValidCalendarZonedDateTime } from "../validate";

/**
 * Return true when the half-open intervals `[aStart, aEnd)` and `[bStart, bEnd)` share at least
 * one instant.
 *
 * - Uses `Temporal.Instant.compare` for comparison (same instant semantics):
 *   `aStart < bEnd && bStart < aEnd`, the same rule as `intervalsOverlap` (SQL:2011 `OVERLAPS` on
 *   closed-open periods).
 * - An interval excludes its `end`, so touching intervals (`aEnd` the same instant as `bStart`) do
 *   NOT overlap — returns `false`.
 * - An empty interval (`start` and `end` the same instant) overlaps an interval only when it lies
 *   strictly inside it; at either edge, or against another empty interval, it returns `false`.
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
 * @param aStart ISO 8601 zoned datetime string for the first interval start
 * @param aEnd ISO 8601 zoned datetime string for the first interval end
 * @param bStart ISO 8601 zoned datetime string for the second interval start
 * @param bEnd ISO 8601 zoned datetime string for the second interval end
 * @returns true if intervals overlap, or false on invalid input
 *
 * @example intervalsOverlapZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-06-30T23:59:59+00:00[UTC]", "2024-04-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // true
 * @example intervalsOverlapZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-07-01T00:00:00+00:00[UTC]", "2024-07-01T00:00:00+00:00[UTC]", "2024-12-31T00:00:00+00:00[UTC]") // false (touching: the first interval excludes 07-01T00:00)
 * @example intervalsOverlapZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-01-01T12:00:00+00:00[UTC]", "2024-01-01T07:00:00-05:00[America/New_York]", "2024-01-01T17:00:00+00:00[UTC]") // false (touching across zones)
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

    // Each interval starts before the other's exclusive end.
    return halfOpenOverlap(
      { start: aSI, end: aEI },
      { start: bSI, end: bEI },
      Temporal.Instant.compare,
    );
  } catch {
    return false;
  }
}
