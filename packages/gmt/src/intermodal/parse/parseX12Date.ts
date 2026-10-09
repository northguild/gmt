import { readEdiValue } from "../../internal/ediDateTimeFields";
import type { X12DateFormat } from "../../types/edi";

/**
 * Parse an X12 Date Time Period value that states a calendar date, as an ISO 8601 date.
 *
 * A `DTP` segment carries a format qualifier in `DTP-02` (data element **1250**) and its value
 * in `DTP-03` (data element **1251**); `DTM-05` and `DTM-06` carry the same pair. This function
 * reads the codes whose value is a date. Codes are release 005010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-005010/element/1250); the X12
 * text itself was not reached.
 *
 * ### Format codes
 * | Code | Mask | The dictionary's definition |
 * |---|---|---|
 * | `D8` | `CCYYMMDD` | "Date Expressed in Format CCYYMMDD" |
 * | `DB` | `MMDDCCYY` | "Date Expressed in Format MMDDCCYY" |
 *
 * - The value must be the eight digits of its code's mask. The same digits can read two ways,
 *   so the code decides: `"12112010"` is 11 December 2010 under `DB` and not a date under `D8`.
 * - **`D8` also reads data element 373 (Date)**, the `CCYYMMDD` date element of `AT7`, `G62`
 *   and `DTM-02`. To read that date and its time element together, use `parseX12DateAndTime`.
 * - Fields are checked, not clamped: month 13, 31 June and 29 February 2023 return `""`.
 * - A two-digit year (`D6` `YYMMDD`, `TT` `MMDDYY`) is not read: X12 does not say which century
 *   it belongs to. Read one with
 *   `parseDateWithPattern("240615", "yyMMdd", undefined, { yearWindow: 2000 })`.
 * - Returns `""` for any other code, a code of another kind included (`DT` is read by
 *   `parseX12DateTime`), and for a non-string argument.
 *
 * @param value The data element 1251 value (e.g. "20240615")
 * @param format X12 data element 1250 format qualifier
 * @returns the date as `YYYY-MM-DD`, or "" on invalid input
 *
 * @example parseX12Date("20240615", "D8") // "2024-06-15"
 * @example parseX12Date("06152024", "DB") // "2024-06-15"
 * @example parseX12Date("20240615", "DB") // "" (20 is not a month)
 * @example parseX12Date("20230229", "D8") // "" (2023 has no 29 February)
 * @example parseX12Date("240615", "D8") // "" (a two-digit year is not read)
 * @example parseX12Date("202406151430", "DT") // "" (a date-time code: use parseX12DateTime)
 */
export function parseX12Date(value: string, format: X12DateFormat): string {
  try {
    return readEdiValue("x12", "date", format, value);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
