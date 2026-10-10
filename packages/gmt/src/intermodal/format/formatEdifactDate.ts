import { writeEdiValue } from "../../internal/ediDateTimeWriter";
import type { EdifactDateFormat } from "../../types/edi";

/**
 * Write an ISO 8601 date as a UN/EDIFACT `DTM` value (data element 2380) in a date format code
 * (data element 2379). The inverse of `parseEdifactDate`: what one writes, the other reads back.
 *
 * The mask and description are the UNTDID directory's, read from
 * [UNECE's D.21B page as archived](http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm).
 *
 * ### Format code
 * | Code | Mask | The directory's description |
 * |---|---|---|
 * | `102` | `CCYYMMDD` | "Calendar date: C = Century ; Y = Year ; M = Month ; D = Day." |
 *
 * - `value` is a date, as `isValidDate` accepts it. A date-time, an instant or a time returns
 *   `""`, as `formatDate` returns `""` for them: pass the date alone.
 * - Each field is zero-padded to the width the mask gives it.
 * - A year outside 0000–9999 returns `""`: `CCYY` is four digits and no sign.
 * - No function writes a two-digit year (`101`, `YYMMDD`): the one date code that is written
 *   holds the whole year.
 * - Returns `""` for any other code, a code of another kind included, and for a non-string
 *   argument.
 *
 * @param value ISO 8601 date (e.g. "2024-06-15")
 * @param format The data element 2379 format code
 * @returns the data element 2380 value, or "" on invalid input
 *
 * @example formatEdifactDate("2024-06-15", "102") // "20240615"
 * @example formatEdifactDate("0987-01-05", "102") // "09870105"
 * @example formatEdifactDate("2024-06-15T14:30:00", "102") // "" (a date-time is not a date)
 * @example formatEdifactDate("2023-02-29", "102") // "" (not a real date)
 * @example formatEdifactDate("+010000-01-01", "102") // "" (the mask holds four digits of year)
 * @example formatEdifactDate("2024-06-15", "203") // "" (a date-time code: use formatEdifactDateTime)
 */
export function formatEdifactDate(
  value: string,
  format: EdifactDateFormat,
): string {
  try {
    return writeEdiValue("edifact", "date", format, value);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
