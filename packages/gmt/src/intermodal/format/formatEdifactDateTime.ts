import { writeEdiValue } from "../../internal/ediDateTimeWriter";
import type { EdifactDateTimeFormat } from "../../types/edi";

/**
 * Write an ISO 8601 local date-time as a UN/EDIFACT `DTM` value (data element 2380) in a format
 * code with no offset (data element 2379). The inverse of `parseEdifactDateTime`.
 *
 * Masks and descriptions are the UNTDID directory's, read from
 * [UNECE's D.21B page as archived](http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm).
 *
 * ### Format codes
 * | Code | Mask | The directory's description |
 * |---|---|---|
 * | `203` | `CCYYMMDDHHMM` | "Calendar date including time with minutes" |
 * | `204` | `CCYYMMDDHHMMSS` | "Calendar date including time with seconds" |
 *
 * - `value` is a local date-time, as `isValidDateTime` accepts it. A date, a time, an instant
 *   ending in `Z` and a date-time with an offset return `""`: these codes hold no offset. Write
 *   an instant with `formatEdifactOffsetDateTime`.
 * - Precision is cut to the mask, never rounded: a fraction of a second is always dropped, and
 *   `203` drops the seconds too. `2024-06-15T14:30:45.9` is `202406151430` under `203` and
 *   `20240615143045` under `204`.
 * - A year outside 0000–9999 returns `""`: `CCYY` is four digits and no sign.
 * - Returns `""` for any other code, a code of another kind included, and for a non-string
 *   argument.
 *
 * @param value ISO 8601 local date-time (e.g. "2024-06-15T14:30:00")
 * @param format The data element 2379 format code
 * @returns the data element 2380 value, or "" on invalid input
 *
 * @example formatEdifactDateTime("2024-06-15T14:30:00", "203") // "202406151430"
 * @example formatEdifactDateTime("2024-06-15T14:30:45", "204") // "20240615143045"
 * @example formatEdifactDateTime("2024-06-15T14:30:45", "203") // "202406151430" (the mask has no seconds)
 * @example formatEdifactDateTime("2024-06-15T14:30:45.9", "204") // "20240615143045" (cut, not rounded)
 * @example formatEdifactDateTime("2024-06-15", "203") // "" (a date is not a date-time)
 * @example formatEdifactDateTime("2024-06-15T14:30:00Z", "203") // "" (the code holds no offset)
 * @example formatEdifactDateTime("2023-02-29T14:30:00", "203") // "" (not a real date)
 */
export function formatEdifactDateTime(
  value: string,
  format: EdifactDateTimeFormat,
): string {
  try {
    return writeEdiValue("edifact", "dateTime", format, value);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
