import { writeEdiValue } from "../../internal/ediDateTimeWriter";
import type { EdifactOffsetDateTimeFormat } from "../../types/edi";

/**
 * Write an ISO 8601 date-time with an offset as a UN/EDIFACT `DTM` value (data element 2380) in
 * a format code that carries an offset (data element 2379). The inverse of
 * `parseEdifactOffsetDateTime`.
 *
 * Masks and descriptions are the UNTDID directory's, read from
 * [UNECE's D.21B page as archived](http://web.archive.org/web/20240303123657/https://service.unece.org/trade/untdid/d21b/tred/tred2379.htm).
 *
 * ### Format codes
 * | Code | Mask | The directory's description |
 * |---|---|---|
 * | `205` | `CCYYMMDDHHMMZHHMM` | "Calendar date including time and time zone expressed in hours and minutes." |
 * | `208` | `CCYYMMDDHHMMSSZHHMM` | "Calendar date including time with seconds, with Time Zone" (D.12A and later) |
 * | `303` | `CCYYMMDDHHMMZZZ` | "See 203 plus Z=Time zone." |
 * | `304` | `CCYYMMDDHHMMSSZZZ` | "See 204 plus Z=Time zone." |
 *
 * - `value` is an ISO 8601 date-time with an offset (`2024-06-15T14:30:00+02:00`) or a `Z`
 *   instant, as `toOffsetInstant` reads it: the string `parseEdifactOffsetDateTime` returns and
 *   `fromOffsetInstant` writes. A local date-time, a date and a time return `""`: there is no
 *   offset to write.
 * - **The digits are the value's own wall clock**, never the UTC clock:
 *   `2024-01-01T00:30:00+02:00` under `303` is `202401010030+02`. A `Z` instant is written on
 *   the UTC clock with `+0000` or `+00`.
 * - **`ZZZ` (`303`, `304`) is always written `±HH`**, the hours-only form of UN/ECE
 *   Recommendation 7 ¶12, never `UTC` or `GMT`. **It holds whole hours only**: an offset such
 *   as `+05:30` returns `""` under `303` and `304`. Write it under `205` or `208`, whose `ZHHMM`
 *   holds hours and minutes.
 * - **An offset with a non-zero seconds part returns `""` under every code**, `205` and `208`
 *   included. A seconds part of zero (`+02:00:00`) is the offset `+02:00` and is written.
 *   `ZHHMM` holds hours and minutes and `ZZZ` hours, so no mask holds the seconds of an offset
 *   such as `-00:44:30`, the offset `Africa/Monrovia` kept until 1972. An offset is never
 *   rounded: the value would name another instant. Write the same instant in `Z` form
 *   instead.
 * - Precision is cut to the mask, never rounded: a fraction of a second is always dropped, and
 *   `205` and `303` drop the seconds too.
 * - **The output is the element value, not segment text.** `+` is the EDIFACT data element
 *   separator, so a value that holds one must be released when it is placed in a segment: write
 *   `?+`. The function does not add the release character.
 * - A bracketed RFC 9557 time zone is read as `toOffsetInstant` reads it: it must agree with
 *   the offset, and beside `Z` it sets the clock the digits are written on.
 * - A wall clock whose year is outside 0000–9999 returns `""`.
 * - Returns `""` for any other code, a code of another kind included, and for a non-string
 *   argument.
 *
 * @param value ISO 8601 date-time with an offset or `Z` (e.g. "2024-06-15T14:30:00+02:00")
 * @param format The data element 2379 format code
 * @returns the data element 2380 value, unescaped, or "" on invalid input
 *
 * @example formatEdifactOffsetDateTime("2024-06-15T14:30:00+02:00", "205") // "202406151430+0200"
 * @example formatEdifactOffsetDateTime("2024-06-15T14:30:45+05:30", "208") // "20240615143045+0530"
 * @example formatEdifactOffsetDateTime("2024-06-15T14:30:00+02:00", "303") // "202406151430+02"
 * @example formatEdifactOffsetDateTime("2024-06-15T14:30:45-05:00", "304") // "20240615143045-05"
 * @example formatEdifactOffsetDateTime("2024-06-15T14:30:00Z", "205") // "202406151430+0000"
 * @example formatEdifactOffsetDateTime("2024-06-15T14:30:00Z", "303") // "202406151430+00" (never "UTC")
 * @example formatEdifactOffsetDateTime("2024-06-15T14:30:45.9+02:00", "205") // "202406151430+0200" (cut to the minute)
 * @example formatEdifactOffsetDateTime("2024-06-15T14:30:00+05:30", "303") // "" (the field holds whole hours: use 205 or 208)
 * @example formatEdifactOffsetDateTime("1960-01-01T00:20:00-00:44:30", "208") // "" (no mask holds a non-zero seconds part of an offset)
 * @example formatEdifactOffsetDateTime("2024-06-15T14:30:00", "205") // "" (a local date-time has no offset to write)
 * @example formatEdifactOffsetDateTime("2024-06-15T14:30:00+02:00", "203") // "" (a local code: use formatEdifactDateTime)
 */
export function formatEdifactOffsetDateTime(
  value: string,
  format: EdifactOffsetDateTimeFormat,
): string {
  try {
    return writeEdiValue("edifact", "offsetDateTime", format, value);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
