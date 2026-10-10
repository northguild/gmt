import { readEdiValue } from "../../internal/ediDateTimeFields";
import type { EdifactDateTimeFormat } from "../../types/edi";

/**
 * Parse a UN/EDIFACT `DTM` value that states a date and a time with no offset, as an ISO 8601
 * local date-time.
 *
 * A `DTM` segment carries its value in data element **2380** and, in data element **2379**, the
 * format code that says how to read it. This function reads the codes whose value is a wall
 * clock at a place the value does not name. Masks and descriptions are the UNTDID directory's,
 * read from
 * [UNECE's D.21B page as archived](http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm).
 *
 * ### Format codes
 * | Code | Mask | The directory's description |
 * |---|---|---|
 * | `203` | `CCYYMMDDHHMM` | "Calendar date including time with minutes" |
 * | `204` | `CCYYMMDDHHMMSS` | "Calendar date including time with seconds" |
 *
 * - **The result is local, never UTC.** It carries no `Z` and no offset: reading a `203` value
 *   as UTC is the most common EDI timestamp bug. Pass the result and the place's IANA zone to
 *   `resolveLocal` to get the instant.
 * - The value must be the digits of its code's mask: `"202406151430"` is a `203` value and not
 *   a `204` one.
 * - Seconds are always written in the result, `00` for `203`.
 * - Fields are checked, not clamped: hour 24, second 60, 31 June and 29 February 2023 return
 *   `""`.
 * - A two-digit year (`201`, `202`) is not read: UN/EDIFACT does not say which century it
 *   belongs to. Read one with
 *   `parseDateTimeWithPattern("2406151430", "yyMMddHHmm", undefined, { yearWindow: 2000 })`.
 * - Returns `""` for any other code, a code of another kind included (`205` is read by
 *   `parseEdifactOffsetDateTime`), and for a non-string argument.
 *
 * @param value The data element 2380 value (e.g. "202406151430")
 * @param format The data element 2379 format code
 * @returns the local date-time as `YYYY-MM-DDTHH:MM:SS`, or "" on invalid input
 *
 * @example parseEdifactDateTime("202406151430", "203") // "2024-06-15T14:30:00"
 * @example parseEdifactDateTime("20240615143045", "204") // "2024-06-15T14:30:45"
 * @example parseEdifactDateTime("202406151430", "204") // "" (twelve digits is a 203 value)
 * @example parseEdifactDateTime("202302291430", "203") // "" (2023 has no 29 February)
 * @example parseEdifactDateTime("202406152430", "203") // "" (hour 24)
 * @example parseEdifactDateTime("202406151430+0200", "205") // "" (an offset code: use parseEdifactOffsetDateTime)
 */
export function parseEdifactDateTime(
  value: string,
  format: EdifactDateTimeFormat,
): string {
  try {
    return readEdiValue("edifact", "dateTime", format, value);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
