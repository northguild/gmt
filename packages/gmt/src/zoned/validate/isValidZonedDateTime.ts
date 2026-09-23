import { zonedDateTimeFrom } from "../../internal";
import { hasZonedDateTimeShape } from "../../internal/isoStringBody";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";

/**
 * Validate whether a string is a valid ISO 8601 zoned datetime string.
 *
 * - The part before the first annotation must be ISO 8601 extended format: `<date>T<time>`, then
 *   nothing, `Z`, or a `±HH:MM[:SS[.fraction]]` offset. Basic format (`20241003T143000-0400`), a
 *   space or lower-case `t` separator, a lower-case `z`, an hour-only time or offset, and a date
 *   without a time are rejected, although `Temporal.ZonedDateTime.from` reads them.
 * - Uses Temporal.ZonedDateTime.from for validation.
 * - Rejects leap seconds.
 * - Reads RFC 9557 annotations as `Temporal.ZonedDateTime.from` does: elective ones
 *   (`[foo=bar]`) are ignored and an unknown critical one (`[!foo=bar]`) is rejected.
 * - The calendar must be ISO: `[u-ca=iso8601]` is accepted, and a non-ISO calendar annotation is
 *   `isValidCalendarZonedDateTime`'s input.
 * - Returns false for non-strings or empty strings.
 *
 * @param value candidate zoned datetime string
 * @returns boolean indicating validity
 *
 * @example isValidZonedDateTime("2024-02-29T12:34:56.789+00:00[UTC]") // true
 * @example isValidZonedDateTime("2024-06-30T23:59:60+00:00[UTC]") // false (leap second)
 * @example isValidZonedDateTime("2024-02-10T12:00:00-05:00[America/New_York][u-ca=hebrew]") // false (non-ISO calendar: use isValidCalendarZonedDateTime)
 * @example isValidZonedDateTime("2024-02-10T12:00:00-05:00[America/New_York][u-ca=iso8601]") // true
 * @example isValidZonedDateTime("2024-02-10T12:00:00-05:00[America/New_York][foo=bar]") // true (elective annotation ignored)
 * @example isValidZonedDateTime("20241003T143000-0400[America/New_York]") // false (basic format)
 * @example isValidZonedDateTime("2024-10-03 14:30:00-04:00[America/New_York]") // false (space separator)
 * @example isValidZonedDateTime("2024-10-03[America/New_York]") // false (no time)
 * @example isValidZonedDateTime("invalid") // false
 */
export function isValidZonedDateTime(value: string): boolean {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  if (isLeapSecond(value) || !hasZonedDateTimeShape(value)) {
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
