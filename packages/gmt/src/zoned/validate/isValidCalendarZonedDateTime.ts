import { parseCalendarZonedValue } from "../../internal";

/**
 * Return true if `value` is a valid GMT ZonedDateTime string: a bare ISO zoned datetime
 * ("2024-10-03T14:30:45-04:00[America/New_York]") or a calendar-annotated zoned datetime with
 * calendar-native fields ("5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]"), as
 * produced by `convertZonedToCalendar`.
 *
 * - Parallel to `isValidZonedDateTime`, which is deliberately left unchanged and still rejects
 *   every `[u-ca=...]` annotation (E7, issue #152). Only the ~18 calendar-aware `zoned/`
 *   functions gate on this validator; the ~72 that stay out of E7's scope keep the old one, so a
 *   string can never be certified valid by a validator whose own namespace still refuses it.
 * - Rejects Temporal's own `[timeZone][u-ca=...]` RFC 9557 ordering, and a GMT-shaped string in
 *   that ordering, for the reason spelled out in `regex/calendar-zoned-date-time.ts`: the latter
 *   parses silently and wrongly (Hebrew year 5784 read as ISO year 5784).
 * - Rejects leap seconds, which `Temporal.ZonedDateTime.from` otherwise clamps to `:59`.
 * - Delegates all field-range, era, calendar-identifier and time-zone checking to Temporal (via
 *   `parseCalendarZonedValue`) — the regex proves shape only.
 * - Returns false for non-strings or empty strings.
 *
 * @param value candidate zoned datetime string, optionally calendar-annotated
 * @returns boolean indicating validity
 *
 * @example isValidCalendarZonedDateTime("2024-10-03T14:30:45-04:00[America/New_York]") // true
 * @example isValidCalendarZonedDateTime("5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]") // true
 * @example isValidCalendarZonedDateTime("0031-04-30T12:00:00+09:00[u-ca=japanese;era=heisei][Asia/Tokyo]") // true
 * @example isValidCalendarZonedDateTime("5784-06-15T14:30:00-05:00[America/New_York][u-ca=hebrew]") // false (Temporal's segment ordering)
 * @example isValidCalendarZonedDateTime("5785-13-15T14:30:00-05:00[u-ca=hebrew][America/New_York]") // false (5785 is not a Hebrew leap year, so month 13 does not exist)
 * @example isValidCalendarZonedDateTime("2024-06-30T23:59:60+00:00[UTC]") // false (leap second)
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
