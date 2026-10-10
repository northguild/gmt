import { writeEdiValue } from "../../internal/ediDateTimeWriter";
import type { EdifactTimeFormat } from "../../types/edi";

/**
 * Write an ISO 8601 time as a UN/EDIFACT `DTM` value (data element 2380) in a time format code
 * (data element 2379). The inverse of `parseEdifactTime`.
 *
 * Masks and descriptions are the UNTDID directory's, read from
 * [UNECE's D.21B page as archived](http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm).
 *
 * ### Format codes
 * | Code | Mask | The directory's description |
 * |---|---|---|
 * | `401` | `HHMM` | "Time without seconds: H = Hour; m = Minute." |
 * | `402` | `HHMMSS` | "Time with seconds: H = Hour; m = Minute; s = Seconds." |
 *
 * - `value` is a time, as `isValidTime` accepts it: `HH:MM`, with seconds and a fraction of a
 *   second if it has them. A date-time, a date or a time with an offset returns `""`.
 * - Precision is cut to the mask, never rounded: a fraction of a second is always dropped, and
 *   `401` drops the seconds too. `14:30:59.9` is `1430` under `401` and `143059` under `402`,
 *   and `parseEdifactTime` reads back the time the mask holds.
 * - Returns `""` for any other code, a code of another kind included, and for a non-string
 *   argument.
 *
 * @param value ISO 8601 time (e.g. "14:30:00")
 * @param format The data element 2379 format code
 * @returns the data element 2380 value, or "" on invalid input
 *
 * @example formatEdifactTime("14:30:00", "401") // "1430"
 * @example formatEdifactTime("14:30:45", "402") // "143045"
 * @example formatEdifactTime("14:30:45", "401") // "1430" (the mask has no seconds)
 * @example formatEdifactTime("14:30:45.9", "402") // "143045" (cut, not rounded)
 * @example formatEdifactTime("14:30", "402") // "143000"
 * @example formatEdifactTime("2024-06-15T14:30:00", "401") // "" (a date-time is not a time)
 * @example formatEdifactTime("24:00", "401") // "" (not a real time)
 */
export function formatEdifactTime(
  value: string,
  format: EdifactTimeFormat,
): string {
  try {
    return writeEdiValue("edifact", "time", format, value);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
