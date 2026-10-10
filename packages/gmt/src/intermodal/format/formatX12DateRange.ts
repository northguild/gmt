import { writeEdiRange } from "../../internal/ediDateTimeWriter";
import type { X12DateRangeFormat } from "../../types/edi";

/**
 * Write two ISO 8601 dates as an X12 Date Time Period range (data element 1251) in a date range
 * format qualifier (data element 1250). The inverse of `parseX12DateRange`.
 *
 * Codes are release 005010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-005010/element/1250); the X12
 * text itself was not reached.
 *
 * ### Format codes
 * | Code | Mask | The dictionary's definition |
 * |---|---|---|
 * | `RD8` | `CCYYMMDD-CCYYMMDD` | "Range of Dates Expressed in Format CCYYMMDD-CCYYMMDD" |
 * | `RD` | `MMDDCCYY-MMDDCCYY` | "Range of Dates Expressed in Format MMDDCCYY-MMDDCCYY" |
 *
 * - `start` and `end` are dates, as `isValidDate` accepts them: the two members
 *   `parseX12DateRange` returns. A date-time, an instant or a time returns `""`.
 * - **The range is written with the one hyphen X12 transmits**: 15 to 20 June 2024 is
 *   `20240615-20240620` under `RD8`.
 * - **An end before its start returns `""`**: a reversed range names no span of time. An end
 *   equal to its start is written.
 * - A year outside 0000–9999 in either date returns `""`.
 * - Returns `""` for any other code, a code of another kind included, and for a non-string
 *   argument.
 *
 * @param start ISO 8601 date the range starts on (e.g. "2024-06-15")
 * @param end ISO 8601 date the range ends on (e.g. "2024-06-20")
 * @param format X12 data element 1250 format qualifier
 * @returns the data element 1251 value, or "" on invalid input
 *
 * @example formatX12DateRange("2024-06-15", "2024-06-20", "RD8") // "20240615-20240620"
 * @example formatX12DateRange("2024-06-15", "2024-06-20", "RD") // "06152024-06202024"
 * @example formatX12DateRange("2024-06-20", "2024-06-15", "RD8") // "" (the end precedes the start)
 * @example formatX12DateRange("2024-06-15T14:30", "2024-06-20", "RD8") // "" (a date-time is not a date)
 * @example formatX12DateRange("2024-06-15", "2023-02-29", "RD8") // "" (not a real date)
 */
export function formatX12DateRange(
  start: string,
  end: string,
  format: X12DateRangeFormat,
): string {
  try {
    return writeEdiRange("x12", "dateRange", format, start, end);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
