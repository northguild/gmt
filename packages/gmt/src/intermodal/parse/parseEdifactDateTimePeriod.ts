import { readEdiRange } from "../../internal/ediDateTimeFields";
import type {
  EdiDateTimePeriod,
  EdifactDateTimePeriodFormat,
} from "../../types/edi";

/**
 * Parse a UN/EDIFACT `DTM` value that states a period between two local date-times, as its
 * start and end.
 *
 * A `DTM` segment carries its value in data element **2380** and, in data element **2379**, the
 * format code that says how to read it. The mask and description are the UNTDID directory's,
 * read from
 * [UNECE's D.21B page as archived](http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm).
 *
 * ### Format code
 * | Code | Mask | The directory's description |
 * |---|---|---|
 * | `719` | `CCYYMMDDHHMM-CCYYMMDDHHMM` | "A period of time which includes the century, year, month, day, hour and minute. Format of period to be given in actual message without hyphen." |
 *
 * - **A period is transmitted without a hyphen, and a hyphen is rejected.** The hyphen in the
 *   mask is notation: `"202406151430202406201600"` reads and `"202406151430-202406201600"`
 *   returns `null`.
 * - **`start` and `end` are local date-times as transmitted**, each `YYYY-MM-DDTHH:MM:SS` with
 *   seconds `00`. The code carries no offset, so neither names an instant: pass each and the
 *   place's IANA zone to `resolveLocal`.
 * - The directory does not say whether the end is inside the period. Pass the pair to the plain
 *   interval functions as `(start, end)`, for example
 *   `intervalLengthDateTime(period.start, period.end, "hours")`; they leave `end` outside the
 *   interval.
 * - **An end before its start returns `null`**: a reversed period names no span of time. An end
 *   equal to its start is a valid period.
 * - Fields are checked, not clamped: hour 24, minute 60 and 29 February 2023 return `null`.
 * - A two-digit year (`713`, `YYMMDDHHMM-YYMMDDHHMM`) is not read. Split such a value in two
 *   and read each half with `parseDateTimeWithPattern`, a `yy` pattern and its `yearWindow`
 *   option.
 * - Returns `null` for any other code, a code of another kind included (`718` is read by
 *   `parseEdifactDatePeriod`), and for a non-string argument.
 *
 * @param value The data element 2380 value (e.g. "202406151430202406201600")
 * @param format The data element 2379 format code
 * @returns `{ start, end }`, two ISO 8601 local date-times, or null on invalid input
 *
 * @example parseEdifactDateTimePeriod("202406151430202406201600", "719") // { start: "2024-06-15T14:30:00", end: "2024-06-20T16:00:00" }
 * @example parseEdifactDateTimePeriod("202406151430202406151430", "719") // { start: "2024-06-15T14:30:00", end: "2024-06-15T14:30:00" }
 * @example parseEdifactDateTimePeriod("202406151430-202406201600", "719") // null (a period is transmitted without a hyphen)
 * @example parseEdifactDateTimePeriod("202406151431202406151430", "719") // null (the end precedes the start)
 * @example parseEdifactDateTimePeriod("2024061520240620", "718") // null (a date period code: use parseEdifactDatePeriod)
 */
export function parseEdifactDateTimePeriod(
  value: string,
  format: EdifactDateTimePeriodFormat,
): EdiDateTimePeriod | null {
  try {
    return readEdiRange("edifact", "dateTimePeriod", format, value);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return null;
  }
}
