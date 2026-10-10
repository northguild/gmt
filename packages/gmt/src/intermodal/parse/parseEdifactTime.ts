import { readEdiValue } from "../../internal/ediDateTimeFields";
import type { EdifactTimeFormat } from "../../types/edi";

/**
 * Parse a UN/EDIFACT `DTM` value that states a time of day, as an ISO 8601 time.
 *
 * A `DTM` segment carries its value in data element **2380** and, in data element **2379**, the
 * format code that says how to read it. This function reads the codes whose value is a time
 * with no date and no offset. Masks and descriptions are the UNTDID directory's, read from
 * [UNECE's D.21B page as archived](http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm).
 *
 * ### Format codes
 * | Code | Mask | The directory's description |
 * |---|---|---|
 * | `401` | `HHMM` | "Time without seconds: H = Hour; m = Minute." |
 * | `402` | `HHMMSS` | "Time with seconds: H = Hour; m = Minute; s = Seconds." |
 *
 * - The value must be the digits of its code's mask: `"1430"` is a `401` value and not a `402`
 *   one.
 * - Seconds are always written in the result, `00` for `401`.
 * - Fields are checked, not clamped: hour 24, minute 60 and second 60 return `""`.
 * - A time with an offset (`209`, `404`) is not read: with no date it names no instant. Read
 *   the date and time together with `parseEdifactOffsetDateTime` where the partner sends `205`,
 *   `208`, `303` or `304`.
 * - Returns `""` for any other code, a code of another kind included, and for a non-string
 *   argument.
 *
 * @param value The data element 2380 value (e.g. "1430")
 * @param format The data element 2379 format code
 * @returns the time as `HH:MM:SS`, or "" on invalid input
 *
 * @example parseEdifactTime("1430", "401") // "14:30:00"
 * @example parseEdifactTime("143045", "402") // "14:30:45"
 * @example parseEdifactTime("143045", "401") // "" (six digits is a 402 value)
 * @example parseEdifactTime("2400", "401") // "" (hour 24)
 * @example parseEdifactTime("14:30", "401") // "" (the value is the digits of the mask)
 * @example parseEdifactTime("20240615", "102") // "" (a date code: use parseEdifactDate)
 */
export function parseEdifactTime(
  value: string,
  format: EdifactTimeFormat,
): string {
  try {
    return readEdiValue("edifact", "time", format, value);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
