import { writeEdiRange } from "../../internal/ediDateTimeWriter";
import type { X12DateTimeRangeFormat } from "../../types/edi";

/**
 * Write two ISO 8601 local date-times as an X12 Date Time Period range (data element 1251) in a
 * date-time range format qualifier (data element 1250). The inverse of `parseX12DateTimeRange`.
 *
 * Codes are release 005010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-005010/element/1250); the X12
 * text itself was not reached.
 *
 * ### Format codes
 * | Code | Mask | The dictionary's definition |
 * |---|---|---|
 * | `RDT` | `CCYYMMDDHHMM-CCYYMMDDHHMM` | "Range of Date and Time, Expressed in Format CCYYMMDDHHMM-CCYYMMDDHHMM" |
 * | `DTS` | `CCYYMMDDHHMMSS-CCYYMMDDHHMMSS` | "Range of Date and Time Expressed in Format CCYYMMDDHHMMSS-CCYYMMDDHHMMSS" |
 *
 * - `start` and `end` are local date-times, as `isValidDateTime` accepts them: the two members
 *   `parseX12DateTimeRange` returns. A date, an instant ending in `Z` and a date-time with an
 *   offset return `""`: no 1250 code carries an offset.
 * - **The range is written with the one hyphen X12 transmits.**
 * - Precision is cut to the mask, never rounded: a fraction of a second is always dropped from
 *   both ends, and `RDT` drops the seconds too.
 * - **An end before its start returns `""`**: a reversed range names no span of time. The ends
 *   are compared as given, before either is cut to the mask. An end equal to its start is
 *   written.
 * - A year outside 0000–9999 in either end returns `""`.
 * - Returns `""` for any other code, a code of another kind included, and for a non-string
 *   argument.
 *
 * @param start ISO 8601 local date-time the range starts at (e.g. "2024-06-15T14:30:00")
 * @param end ISO 8601 local date-time the range ends at (e.g. "2024-06-20T16:00:00")
 * @param format X12 data element 1250 format qualifier
 * @returns the data element 1251 value, or "" on invalid input
 *
 * @example formatX12DateTimeRange("2024-06-15T14:30:00", "2024-06-20T16:00:00", "RDT") // "202406151430-202406201600"
 * @example formatX12DateTimeRange("2024-06-15T14:30:45", "2024-06-20T16:00:30", "DTS") // "20240615143045-20240620160030"
 * @example formatX12DateTimeRange("2024-06-15T14:30:45", "2024-06-20T16:00:30", "RDT") // "202406151430-202406201600" (the mask has no seconds)
 * @example formatX12DateTimeRange("2024-06-15T14:31:00", "2024-06-15T14:30:00", "RDT") // "" (the end precedes the start)
 * @example formatX12DateTimeRange("2024-06-15", "2024-06-20", "RDT") // "" (dates: use formatX12DateRange)
 */
export function formatX12DateTimeRange(
  start: string,
  end: string,
  format: X12DateTimeRangeFormat,
): string {
  try {
    return writeEdiRange("x12", "dateTimeRange", format, start, end);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
