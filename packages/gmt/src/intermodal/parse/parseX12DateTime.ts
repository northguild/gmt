import { readEdiValue } from "../../internal/ediDateTimeFields";
import type { X12DateTimeFormat } from "../../types/edi";

/**
 * Parse an X12 Date Time Period value that states a date and a time, as an ISO 8601 local
 * date-time.
 *
 * A `DTP` segment carries a format qualifier in `DTP-02` (data element **1250**) and its value
 * in `DTP-03` (data element **1251**); `DTM-05` and `DTM-06` carry the same pair. This function
 * reads the codes whose value is one date-time. Codes are release 005010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-005010/element/1250); the X12
 * text itself was not reached.
 *
 * ### Format codes
 * | Code | Mask | The dictionary's definition |
 * |---|---|---|
 * | `DT` | `CCYYMMDDHHMM` | "Date and Time Expressed in Format CCYYMMDDHHMM" |
 * | `RTS` | `CCYYMMDDHHMMSS` | "Date and Time Expressed in Format CCYYMMDDHHMMSS" |
 *
 * - **The result is local, never UTC.** No 1250 code carries an offset, so the result has no
 *   `Z` and no offset. Pass it and the place's IANA zone to `resolveLocal` to get the instant.
 * - `RTS` is one date-time, despite the `R` that marks a range in other codes.
 * - The value must be the digits of its code's mask: `"202406151430"` is a `DT` value and not
 *   an `RTS` one.
 * - Seconds are always written in the result, `00` for `DT`.
 * - Fields are checked, not clamped: hour 24, second 60, 31 June and 29 February 2023 return
 *   `""`.
 * - **A freight segment sends the date and the time as two elements** (373 and 337 in `AT7`,
 *   `G62` and `DTM-02`/`03`), not as one 1250 value: read those with `parseX12DateAndTime`.
 * - A two-digit year (`TR`, `DDMMYYHHMM`) is not read: X12 does not say which century it
 *   belongs to. Read one with
 *   `parseDateTimeWithPattern("1506241430", "ddMMyyHHmm", undefined, { yearWindow: 2000 })`.
 * - Returns `""` for any other code, a code of another kind included (`D8` is read by
 *   `parseX12Date`), and for a non-string argument.
 *
 * @param value The data element 1251 value (e.g. "202406151430")
 * @param format X12 data element 1250 format qualifier
 * @returns the local date-time as `YYYY-MM-DDTHH:MM:SS`, or "" on invalid input
 *
 * @example parseX12DateTime("202406151430", "DT") // "2024-06-15T14:30:00"
 * @example parseX12DateTime("20240615143045", "RTS") // "2024-06-15T14:30:45"
 * @example parseX12DateTime("202406151430", "RTS") // "" (twelve digits is a DT value)
 * @example parseX12DateTime("202302291430", "DT") // "" (2023 has no 29 February)
 * @example parseX12DateTime("202406152430", "DT") // "" (hour 24)
 * @example parseX12DateTime("20240615", "D8") // "" (a date code: use parseX12Date)
 */
export function parseX12DateTime(
  value: string,
  format: X12DateTimeFormat,
): string {
  try {
    return readEdiValue("x12", "dateTime", format, value);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
