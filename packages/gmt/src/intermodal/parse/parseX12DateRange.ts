import { readEdiRange } from "../../internal/ediDateTimeFields";
import type { EdiDatePeriod, X12DateRangeFormat } from "../../types/edi";

/**
 * Parse an X12 Date Time Period value that states a range between two calendar dates, as its
 * start and end.
 *
 * A `DTP` segment carries a format qualifier in `DTP-02` (data element **1250**) and its value
 * in `DTP-03` (data element **1251**); `DTM-05` and `DTM-06` carry the same pair. Codes are
 * release 005010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-005010/element/1250); the X12
 * text itself was not reached.
 *
 * ### Format codes
 * | Code | Mask | The dictionary's definition |
 * |---|---|---|
 * | `RD8` | `CCYYMMDD-CCYYMMDD` | "Range of Dates Expressed in Format CCYYMMDD-CCYYMMDD" |
 * | `RD` | `MMDDCCYY-MMDDCCYY` | "Range of Dates Expressed in Format MMDDCCYY-MMDDCCYY" |
 *
 * - **A range is transmitted with exactly one hyphen.** Each definition gives the format with
 *   its hyphen: `"20240615-20240620"` reads, and `"2024061520240620"` returns `null`.
 * - **`start` and `end` are the two dates as transmitted**, each `YYYY-MM-DD`. X12 does not say
 *   here whether the end date is inside the range: that is the segment's to define, so no day
 *   is added or removed. Pass the pair to the plain interval functions as `(start, end)`, for
 *   example `intervalLengthDate(range.start, range.end, "days")`; they leave `end` outside the
 *   interval.
 * - **An end before its start returns `null`**: a reversed range names no span of time. An end
 *   equal to its start is a valid range.
 * - Fields are checked, not clamped: month 13, 31 June and 29 February 2023 return `null`.
 * - A two-digit year (`RD6`, `YYMMDD-YYMMDD`) is not read. Split such a value at its hyphen and
 *   read each half with `parseDateWithPattern`, a `yy` pattern and its `yearWindow` option.
 * - Returns `null` for any other code, a code of another kind included (`RDT` is read by
 *   `parseX12DateTimeRange`), and for a non-string argument.
 *
 * @param value The data element 1251 value (e.g. "20240615-20240620")
 * @param format X12 data element 1250 format qualifier
 * @returns `{ start, end }`, two ISO 8601 dates, or null on invalid input
 *
 * @example parseX12DateRange("20240615-20240620", "RD8") // { start: "2024-06-15", end: "2024-06-20" }
 * @example parseX12DateRange("06152024-06202024", "RD") // { start: "2024-06-15", end: "2024-06-20" }
 * @example parseX12DateRange("2024061520240620", "RD8") // null (a range is transmitted with its hyphen)
 * @example parseX12DateRange("20240620-20240615", "RD8") // null (the end precedes the start)
 * @example parseX12DateRange("20230229-20240620", "RD8") // null (2023 has no 29 February)
 * @example parseX12DateRange("20240615", "D8") // null (a date code: use parseX12Date)
 */
export function parseX12DateRange(
  value: string,
  format: X12DateRangeFormat,
): EdiDatePeriod | null {
  try {
    return readEdiRange("x12", "dateRange", format, value);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return null;
  }
}
