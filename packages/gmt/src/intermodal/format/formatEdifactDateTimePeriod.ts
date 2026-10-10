import { writeEdiRange } from "../../internal/ediDateTimeWriter";
import type { EdifactDateTimePeriodFormat } from "../../types/edi";

/**
 * Write two ISO 8601 local date-times as a UN/EDIFACT `DTM` period (data element 2380) in a
 * date-time period format code (data element 2379). The inverse of
 * `parseEdifactDateTimePeriod`.
 *
 * The mask and description are the UNTDID directory's, read from
 * [UNECE's D.21B page as archived](http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm).
 *
 * ### Format code
 * | Code | Mask | The directory's description |
 * |---|---|---|
 * | `719` | `CCYYMMDDHHMM-CCYYMMDDHHMM` | "A period of time which includes the century, year, month, day, hour and minute. Format of period to be given in actual message without hyphen." |
 *
 * - `start` and `end` are local date-times, as `isValidDateTime` accepts them: the two members
 *   `parseEdifactDateTimePeriod` returns. A date, an instant ending in `Z` and a date-time with
 *   an offset return `""`: the code holds no offset.
 * - **The period is written without a hyphen**: 15 June 14:30 to 20 June 16:00 is
 *   `202406151430202406201600`.
 * - Precision is cut to the mask, never rounded: seconds and a fraction of a second are dropped
 *   from both ends.
 * - **An end before its start returns `""`**: a reversed period names no span of time. The ends
 *   are compared as given, before either is cut to the minute. An end equal to its start is
 *   written.
 * - A year outside 0000–9999 in either end returns `""`.
 * - Returns `""` for any other code, a code of another kind included, and for a non-string
 *   argument.
 *
 * @param start ISO 8601 local date-time the period starts at (e.g. "2024-06-15T14:30:00")
 * @param end ISO 8601 local date-time the period ends at (e.g. "2024-06-20T16:00:00")
 * @param format The data element 2379 format code
 * @returns the data element 2380 value, or "" on invalid input
 *
 * @example formatEdifactDateTimePeriod("2024-06-15T14:30:00", "2024-06-20T16:00:00", "719") // "202406151430202406201600"
 * @example formatEdifactDateTimePeriod("2024-06-15T14:30:45", "2024-06-20T16:00:59", "719") // "202406151430202406201600" (the mask has no seconds)
 * @example formatEdifactDateTimePeriod("2024-06-15T14:31:00", "2024-06-15T14:30:00", "719") // "" (the end precedes the start)
 * @example formatEdifactDateTimePeriod("2024-06-15", "2024-06-20", "719") // "" (dates: use formatEdifactDatePeriod)
 * @example formatEdifactDateTimePeriod("2024-06-15T14:30:00Z", "2024-06-20T16:00:00Z", "719") // "" (the code holds no offset)
 */
export function formatEdifactDateTimePeriod(
  start: string,
  end: string,
  format: EdifactDateTimePeriodFormat,
): string {
  try {
    return writeEdiRange("edifact", "dateTimePeriod", format, start, end);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
