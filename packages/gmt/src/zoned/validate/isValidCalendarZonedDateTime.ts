import { parseCalendarZonedValue } from "../../internal";

/**
 * Return true if `value` is a valid GMT ZonedDateTime string: a bare ISO zoned datetime
 * ("2024-10-03T14:30:45-04:00[America/New_York]") or an RFC 9557 calendar-annotated one
 * ("2024-10-03T14:30:45-04:00[America/New_York][u-ca=hebrew]"), as
 * `Temporal.ZonedDateTime#toString()` and `convertZonedToCalendar` write it.
 *
 * - Parallel to `isValidZonedDateTime`, which accepts `[u-ca=iso8601]` and rejects every other
 *   calendar. Only
 *   the calendar-aware `zoned/` functions gate on this validator, so a string is never certified
 *   by a validator whose own namespace refuses it.
 * - The calendar annotation follows the time zone annotation (RFC 9557 §4.1); a calendar before
 *   the zone, which Temporal also rejects, returns false.
 * - A `[u-ca=<id>]` annotation, optionally critical. Temporal's `CanonicalizeCalendar` validates
 *   the id (folding case and aliases), and the calendar must be one GMT supports
 *   (`CalendarSystem`).
 * - The annotations follow Temporal's ISO grammar, as `Temporal.ZonedDateTime.from` reads them:
 *   elective unknown annotations (`[foo=bar]`) are ignored and the first `u-ca` annotation names
 *   the calendar; an unknown critical annotation or a second `u-ca` annotation when either is
 *   critical returns false.
 * - The part before the first annotation must be ISO 8601 extended format, as
 *   `isValidZonedDateTime` requires: basic format, a space or lower-case `t` separator, a
 *   lower-case `z`, an hour-only time or offset and a date without a time return false.
 * - Rejects leap seconds, which `Temporal.ZonedDateTime.from` otherwise clamps to `:59`.
 * - Delegates the date, time, offset, zone and annotation checks to `Temporal.ZonedDateTime.from`
 *   (via `parseCalendarZonedValue`).
 * - Returns false for non-strings or empty strings.
 *
 * Compatibility: since 1.16.0 the string is RFC 9557. Earlier releases accepted calendar-native
 * digits, `;era=`, the calendar annotation before the zone, and the ids `gregorian`, `taiwan`,
 * `islamic-tabular` and `ethiopic-amete-alem`.
 *
 * @param value candidate zoned datetime string, optionally calendar-annotated
 * @returns boolean indicating validity
 *
 * @example isValidCalendarZonedDateTime("2024-10-03T14:30:45-04:00[America/New_York]") // true
 * @example isValidCalendarZonedDateTime("2024-02-24T14:30:00-05:00[America/New_York][u-ca=hebrew]") // true
 * @example isValidCalendarZonedDateTime("2024-02-24T14:30:00-05:00[America/New_York][foo=bar][u-ca=hebrew]") // true (elective annotation ignored)
 * @example isValidCalendarZonedDateTime("2024-02-24T14:30:00-05:00[u-ca=hebrew][America/New_York]") // false (calendar before zone)
 * @example isValidCalendarZonedDateTime("2019-04-30T12:00:00+09:00[Asia/Tokyo][u-ca=japanese;era=heisei]") // false (not RFC 9557)
 * @example isValidCalendarZonedDateTime("2024-02-24T14:30:00+03:00[America/New_York][u-ca=hebrew]") // false (offset wrong for the zone)
 * @example isValidCalendarZonedDateTime("2024-06-30T23:59:60+00:00[UTC]") // false (leap second)
 * @example isValidCalendarZonedDateTime("2024-02-24 14:30:00-05:00[America/New_York][u-ca=hebrew]") // false (space separator)
 * @example isValidCalendarZonedDateTime("invalid") // false
 */
export function isValidCalendarZonedDateTime(value: string): boolean {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  try {
    return parseCalendarZonedValue(value).timeZoneId.length > 0;
  } catch {
    return false;
  }
}
