import { readEdiRange } from "../../internal/ediDateTimeFields";
import type { EdiDatePeriod, EdifactDatePeriodFormat } from "../../types/edi";

/**
 * Parse a UN/EDIFACT `DTM` value that states a period between two calendar dates, as its start
 * and end.
 *
 * A `DTM` segment carries its value in data element **2380** and, in data element **2379**, the
 * format code that says how to read it. The mask and description are the UNTDID directory's,
 * read from
 * [UNECE's D.21B page as archived](http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm).
 *
 * ### Format code
 * | Code | Mask | The directory's description |
 * |---|---|---|
 * | `718` | `CCYYMMDD-CCYYMMDD` | "A period of time specified by giving the start date followed by the end date (both including century). Data is to be transmitted as consecutive characters without hyphen." |
 *
 * - **A period is transmitted without a hyphen, and a hyphen is rejected.** Every directory
 *   read (twelve, from D.93A to D.22B) says so; the hyphen in the mask is notation.
 *   `"2024061520240620"` reads and `"20240615-20240620"` returns `null`.
 * - **`start` and `end` are the two dates as transmitted**, each `YYYY-MM-DD`. The directory
 *   does not say whether the end date is inside the period: that is the message's to define, so
 *   no day is added or removed. Pass the pair to the plain interval functions as `(start, end)`,
 *   for example `intervalLengthDate(period.start, period.end, "days")`; they leave `end`
 *   outside the interval.
 * - **An end before its start returns `null`**: a reversed period names no span of time. An end
 *   equal to its start is a valid period.
 * - Fields are checked, not clamped: month 13, 31 June and 29 February 2023 return `null`.
 * - A two-digit year (`717`, `YYMMDD-YYMMDD`) is not read. Split such a value in two and read
 *   each half with `parseDateWithPattern`, a `yy` pattern and its `yearWindow` option.
 * - Returns `null` for any other code, a code of another kind included (`719` is read by
 *   `parseEdifactDateTimePeriod`), and for a non-string argument.
 *
 * @param value The data element 2380 value (e.g. "2024061520240620")
 * @param format The data element 2379 format code
 * @returns `{ start, end }`, two ISO 8601 dates, or null on invalid input
 *
 * @example parseEdifactDatePeriod("2024061520240620", "718") // { start: "2024-06-15", end: "2024-06-20" }
 * @example parseEdifactDatePeriod("2024061520240615", "718") // { start: "2024-06-15", end: "2024-06-15" }
 * @example parseEdifactDatePeriod("20240615-20240620", "718") // null (a period is transmitted without a hyphen)
 * @example parseEdifactDatePeriod("2024062020240615", "718") // null (the end precedes the start)
 * @example parseEdifactDatePeriod("2023022920240620", "718") // null (2023 has no 29 February)
 * @example parseEdifactDatePeriod("20240615", "102") // null (a date code: use parseEdifactDate)
 */
export function parseEdifactDatePeriod(
  value: string,
  format: EdifactDatePeriodFormat,
): EdiDatePeriod | null {
  try {
    return readEdiRange("edifact", "datePeriod", format, value);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return null;
  }
}
