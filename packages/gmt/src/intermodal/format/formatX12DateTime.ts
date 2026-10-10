import { writeEdiValue } from "../../internal/ediDateTimeWriter";
import type { X12DateTimeFormat } from "../../types/edi";

/**
 * Write an ISO 8601 local date-time as an X12 Date Time Period value (data element 1251) in a
 * date-time format qualifier (data element 1250). The inverse of `parseX12DateTime`.
 *
 * Codes are release 005010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-005010/element/1250); the X12
 * text itself was not reached.
 *
 * ### Format codes
 * | Code | Mask | The dictionary's definition |
 * |---|---|---|
 * | `DT` | `CCYYMMDDHHMM` | "Date and Time Expressed in Format CCYYMMDDHHMM" |
 * | `RTS` | `CCYYMMDDHHMMSS` | "Date and Time Expressed in Format CCYYMMDDHHMMSS" |
 *
 * - `value` is a local date-time, as `isValidDateTime` accepts it. A date and a time return
 *   `""`.
 * - **No 1250 code carries an offset**, so an instant ending in `Z` and a date-time with an
 *   offset return `""`: an instant is not written as a wall clock. Pass the local date-time.
 * - Precision is cut to the mask, never rounded: a fraction of a second is always dropped, and
 *   `DT` drops the seconds too. `2024-06-15T14:30:45.9` is `202406151430` under `DT` and
 *   `20240615143045` under `RTS`.
 * - A year outside 0000–9999 returns `""`: `CCYY` is four digits and no sign.
 * - Returns `""` for any other code, a code of another kind included, and for a non-string
 *   argument.
 *
 * @param value ISO 8601 local date-time (e.g. "2024-06-15T14:30:00")
 * @param format X12 data element 1250 format qualifier
 * @returns the data element 1251 value, or "" on invalid input
 *
 * @example formatX12DateTime("2024-06-15T14:30:00", "DT") // "202406151430"
 * @example formatX12DateTime("2024-06-15T14:30:45", "RTS") // "20240615143045"
 * @example formatX12DateTime("2024-06-15T14:30:45", "DT") // "202406151430" (the mask has no seconds)
 * @example formatX12DateTime("2024-06-15T14:30:45.9", "RTS") // "20240615143045" (cut, not rounded)
 * @example formatX12DateTime("2024-06-15", "DT") // "" (a date is not a date-time)
 * @example formatX12DateTime("2024-06-15T14:30:00Z", "DT") // "" (no 1250 code carries an offset)
 * @example formatX12DateTime("2023-02-29T14:30:00", "DT") // "" (not a real date)
 */
export function formatX12DateTime(
  value: string,
  format: X12DateTimeFormat,
): string {
  try {
    return writeEdiValue("x12", "dateTime", format, value);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
