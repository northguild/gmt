import { hasZonedDateTimeShape } from "../../internal/isoStringBody";
import { zonedDateTimeFrom } from "../../internal/zonedWallClock";
import { hasSecond60 } from "../../plain/validate/hasSecond60";

/**
 * Validate whether a string is a valid ISO 8601 zoned datetime string.
 *
 * - The part before the first annotation must be ISO 8601 extended format: `<date>T<time>`, then
 *   nothing, `Z`, or a `±HH:MM[:SS[.fraction]]` offset. Basic format (`20241003T143000-0400`), a
 *   space or lower-case `t` separator, a lower-case `z`, an hour-only time or offset, and a date
 *   without a time are rejected, although `Temporal.ZonedDateTime.from` reads them.
 * - Uses Temporal.ZonedDateTime.from for validation.
 * - A written offset must agree with the bracketed zone, as TC39 `ToTemporalZonedDateTime`
 *   matches it: an offset written to the minute may be the zone's sub-minute offset rounded
 *   (`-00:45[Africa/Monrovia]` for −00:44:30, which is how Temporal writes it), and an offset
 *   written with seconds must be the zone's offset exactly.
 * - Rejects leap seconds.
 * - With an offset, the local date must be inside Temporal's date range, as
 *   `Temporal.ZonedDateTime.from` requires (`CheckISODaysRange`): a zoned string on
 *   −271821-04-19, which a zone west of Greenwich shows for the first hours of the instant
 *   range, is rejected although `isValidInstant` accepts it.
 * - Reads RFC 9557 annotations as `Temporal.ZonedDateTime.from` does: elective ones
 *   (`[foo=bar]`) are ignored and an unknown critical one (`[!foo=bar]`) is rejected.
 * - The calendar must be ISO: `[u-ca=iso8601]` is accepted, and a non-ISO calendar annotation is
 *   `isValidCalendarZonedDateTime`'s input.
 * - Returns false for an empty string.
 * - A value that is not a string, a `String` object included, returns `false`. A `true` result
 *   narrows an `unknown` value to `string`.
 *
 * @param value any value; a string is checked as an ISO 8601 zoned datetime
 * @returns boolean indicating validity
 *
 * @example isValidZonedDateTime("2024-02-29T12:34:56.789+00:00[UTC]") // true
 * @example isValidZonedDateTime("2024-06-30T23:59:60+00:00[UTC]") // false (leap second)
 * @example isValidZonedDateTime("2024-02-10T12:00:00+11:00[Australia/Sydney][u-ca=hebrew]") // false (non-ISO calendar: use isValidCalendarZonedDateTime)
 * @example isValidZonedDateTime("2024-02-10T12:00:00+11:00[Australia/Sydney][u-ca=iso8601]") // true
 * @example isValidZonedDateTime("2024-02-10T12:00:00+11:00[Australia/Sydney][foo=bar]") // true (elective annotation ignored)
 * @example isValidZonedDateTime("20241003T143000+0530[Asia/Kolkata]") // false (basic format)
 * @example isValidZonedDateTime("2024-10-03 14:30:00+05:30[Asia/Kolkata]") // false (space separator)
 * @example isValidZonedDateTime("2024-10-03[Asia/Kolkata]") // false (no time)
 * @example isValidZonedDateTime("2024-10-03T14:30:00+00:00[Europe/London]") // false (London is +01:00 in early October)
 * @example isValidZonedDateTime("1960-01-01T00:20:00-00:45[Africa/Monrovia]") // true (-00:45 is Monrovia's -00:44:30, rounded)
 * @example isValidZonedDateTime("1960-01-01T00:20:00-00:44:30[Africa/Monrovia]") // true
 * @example isValidZonedDateTime("1960-01-01T00:20:00-00:45:00[Africa/Monrovia]") // false (an offset with seconds must be exact)
 * @example isValidZonedDateTime("-271821-04-19T23:59:00-00:01[Europe/London]") // false (the local date is before Temporal's date range)
 * @example isValidZonedDateTime("invalid") // false
 * @example isValidZonedDateTime(null) // false
 */
export function isValidZonedDateTime(value: string): boolean;
export function isValidZonedDateTime(
  value: {} | null | undefined | void,
): boolean;
export function isValidZonedDateTime(value: unknown): value is string;
export function isValidZonedDateTime(value: unknown): boolean {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  if (hasSecond60(value) || !hasZonedDateTimeShape(value)) {
    return false;
  }

  try {
    const zonedDateTime = zonedDateTimeFrom(value);
    return (
      zonedDateTime.timeZoneId.length > 0 &&
      zonedDateTime.calendarId === "iso8601"
    );
  } catch {
    return false;
  }
}
