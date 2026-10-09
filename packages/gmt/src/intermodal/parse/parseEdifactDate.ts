import { readEdiValue } from "../../internal/ediDateTimeFields";
import type { EdifactDateFormat } from "../../types/edi";

/**
 * Parse a UN/EDIFACT `DTM` value that states a calendar date, as an ISO 8601 date.
 *
 * A `DTM` segment carries its value in data element **2380** and, in data element **2379**, the
 * format code that says how to read it. This function reads the code whose value is a date. The
 * mask and description are the UNTDID directory's, read from
 * [UNECE's D.21B page as archived](http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm).
 *
 * ### Format code
 * | Code | Mask | The directory's description |
 * |---|---|---|
 * | `102` | `CCYYMMDD` | "Calendar date: C = Century ; Y = Year ; M = Month ; D = Day." |
 *
 * - The value must be the eight digits of the mask and nothing else: a hyphen, a space or a
 *   ninth digit returns `""`.
 * - Fields are checked, not clamped: month 13, 31 June and 29 February 2023 return `""`.
 * - The year is the four digits as written, `0000` to `9999`.
 * - A two-digit year (`101`, `YYMMDD`) is not read: UN/EDIFACT does not say which century it
 *   belongs to. Read one with
 *   `parseDateWithPattern("240615", "yyMMdd", undefined, { yearWindow: 2000 })`.
 * - Returns `""` for any other code, a code of another kind included (`203` is read by
 *   `parseEdifactDateTime`); `classifyEdifactDtmFormat` names the kind of a code. Returns `""`
 *   for a non-string argument.
 *
 * @param value The data element 2380 value (e.g. "20240615")
 * @param format The data element 2379 format code
 * @returns the date as `YYYY-MM-DD`, or "" on invalid input
 *
 * @example parseEdifactDate("20240615", "102") // "2024-06-15"
 * @example parseEdifactDate("20240229", "102") // "2024-02-29"
 * @example parseEdifactDate("20230229", "102") // "" (2023 has no 29 February)
 * @example parseEdifactDate("2024-06-15", "102") // "" (the value is the digits of the mask)
 * @example parseEdifactDate("240615", "102") // "" (a two-digit year is not read)
 * @example parseEdifactDate("202406151430", "203") // "" (a date-time code: use parseEdifactDateTime)
 */
export function parseEdifactDate(
  value: string,
  format: EdifactDateFormat,
): string {
  try {
    return readEdiValue("edifact", "date", format, value);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
