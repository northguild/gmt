import { writeEdiRange } from "../../internal/ediDateTimeWriter";
import type { EdifactDatePeriodFormat } from "../../types/edi";

/**
 * Write two ISO 8601 dates as a UN/EDIFACT `DTM` period (data element 2380) in a date period
 * format code (data element 2379). The inverse of `parseEdifactDatePeriod`.
 *
 * The mask and description are the UNTDID directory's, read from
 * [UNECE's D.21B page as archived](http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm).
 *
 * ### Format code
 * | Code | Mask | The directory's description |
 * |---|---|---|
 * | `718` | `CCYYMMDD-CCYYMMDD` | "A period of time specified by giving the start date followed by the end date (both including century). Data is to be transmitted as consecutive characters without hyphen." |
 *
 * - `start` and `end` are dates, as `isValidDate` accepts them: the two members
 *   `parseEdifactDatePeriod` returns. A date-time or an instant returns `""`.
 * - **The period is written without a hyphen**, as every directory read says it is
 *   transmitted: 15 to 20 June 2024 is `2024061520240620`.
 * - **An end before its start returns `""`**: a reversed period names no span of time. An end
 *   equal to its start is written.
 * - A year outside 0000–9999 in either date returns `""`.
 * - Returns `""` for any other code, a code of another kind included, and for a non-string
 *   argument.
 *
 * @param start ISO 8601 date the period starts on (e.g. "2024-06-15")
 * @param end ISO 8601 date the period ends on (e.g. "2024-06-20")
 * @param format The data element 2379 format code
 * @returns the data element 2380 value, or "" on invalid input
 *
 * @example formatEdifactDatePeriod("2024-06-15", "2024-06-20", "718") // "2024061520240620"
 * @example formatEdifactDatePeriod("2024-06-15", "2024-06-15", "718") // "2024061520240615"
 * @example formatEdifactDatePeriod("2024-06-20", "2024-06-15", "718") // "" (the end precedes the start)
 * @example formatEdifactDatePeriod("2024-06-15T14:30", "2024-06-20", "718") // "" (a date-time is not a date)
 * @example formatEdifactDatePeriod("2024-06-15", "2023-02-29", "718") // "" (not a real date)
 */
export function formatEdifactDatePeriod(
  start: string,
  end: string,
  format: EdifactDatePeriodFormat,
): string {
  try {
    return writeEdiRange("edifact", "datePeriod", format, start, end);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
