import { readEdiRange } from "../../internal/ediDateTimeFields";
import type {
  EdiDateTimePeriod,
  X12DateTimeRangeFormat,
} from "../../types/edi";

/**
 * Parse an X12 Date Time Period value that states a range between two local date-times, as its
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
 * | `RDT` | `CCYYMMDDHHMM-CCYYMMDDHHMM` | "Range of Date and Time, Expressed in Format CCYYMMDDHHMM-CCYYMMDDHHMM" |
 * | `DTS` | `CCYYMMDDHHMMSS-CCYYMMDDHHMMSS` | "Range of Date and Time Expressed in Format CCYYMMDDHHMMSS-CCYYMMDDHHMMSS" |
 *
 * - **A range is transmitted with exactly one hyphen**: `"202406151430-202406201600"` reads,
 *   and the same digits run together return `null`.
 * - **`start` and `end` are local date-times as transmitted**, each `YYYY-MM-DDTHH:MM:SS`, with
 *   seconds `00` for `RDT`. No 1250 code carries an offset, so neither names an instant: pass
 *   each and the place's IANA zone to `resolveLocal`.
 * - X12 does not say here whether the end is inside the range. Pass the pair to the plain
 *   interval functions as `(start, end)`, for example
 *   `intervalLengthDateTime(range.start, range.end, "hours")`; they leave `end` outside the
 *   interval.
 * - `DTS` is a range, despite having no `R`.
 * - **An end before its start returns `null`**: a reversed range names no span of time. An end
 *   equal to its start is a valid range.
 * - Fields are checked, not clamped: hour 24, second 60 and 29 February 2023 return `null`.
 * - A range with a date on one side and a date-time on the other (`DDT`, `DTD`) is not read,
 *   and neither is a range of times with no date (`RTM`).
 * - Returns `null` for any other code, a code of another kind included (`RD8` is read by
 *   `parseX12DateRange`), and for a non-string argument.
 *
 * @param value The data element 1251 value (e.g. "202406151430-202406201600")
 * @param format X12 data element 1250 format qualifier
 * @returns `{ start, end }`, two ISO 8601 local date-times, or null on invalid input
 *
 * @example parseX12DateTimeRange("202406151430-202406201600", "RDT") // { start: "2024-06-15T14:30:00", end: "2024-06-20T16:00:00" }
 * @example parseX12DateTimeRange("20240615143045-20240620160030", "DTS") // { start: "2024-06-15T14:30:45", end: "2024-06-20T16:00:30" }
 * @example parseX12DateTimeRange("202406151430202406201600", "RDT") // null (a range is transmitted with its hyphen)
 * @example parseX12DateTimeRange("202406151431-202406151430", "RDT") // null (the end precedes the start)
 * @example parseX12DateTimeRange("20240615-20240620", "RD8") // null (a date range code: use parseX12DateRange)
 */
export function parseX12DateTimeRange(
  value: string,
  format: X12DateTimeRangeFormat,
): EdiDateTimePeriod | null {
  try {
    return readEdiRange("x12", "dateTimeRange", format, value);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return null;
  }
}
