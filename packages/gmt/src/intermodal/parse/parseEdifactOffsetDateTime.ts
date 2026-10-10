import { readEdiValue } from "../../internal/ediDateTimeFields";
import type { EdifactOffsetDateTimeFormat } from "../../types/edi";

/**
 * Parse a UN/EDIFACT `DTM` value that states a date and a time with an offset from UTC, as an
 * ISO 8601 date-time with its offset.
 *
 * A `DTM` segment carries its value in data element **2380** and, in data element **2379**, the
 * format code that says how to read it. This function reads the codes whose value names an
 * instant. Masks and descriptions are the UNTDID directory's, read from
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
 * - **The result is the wall clock as written, with its offset**: `YYYY-MM-DDTHH:MM:SS±HH:MM`,
 *   on its own day and never moved to UTC. It is the string `fromOffsetInstant` writes, so
 *   `toOffsetInstant` reads it as the instant and the offset, and every function that takes an
 *   instant takes it.
 * - **`ZHHMM` (`205`, `208`) is a sign, hours and minutes** (`+0200`, `-0330`). `-0000` is read
 *   as `+00:00`.
 * - **`ZZZ` (`303`, `304`) is read as an offset only.** A signed hour from `00` to `23` (`+02`,
 *   `-05`) is that offset: UN/ECE Recommendation 7 ¶12 appends the difference from UTC "in hours
 *   and minutes, or hours only, with a leading "+" or "-" sign". The literals `UTC` and `GMT`
 *   are `+00:00`: the SMDG container-shipping guides write `UTC` in a `303` value, and
 *   Recommendation 7 ¶12 names one scale by both names, "Co-ordinated Universal Time (formerly
 *   known as Greenwich Mean Time)".
 * - **Any other three characters return `""`**, letters such as `CET` included: the directory
 *   says only "Z = Time zone", no standard defines an abbreviation, and GMT does not guess what
 *   one means. Where a partner sends one, read the wall clock with `parseEdifactDateTime` after
 *   removing the three letters, and resolve it in the IANA zone you map them to with
 *   `resolveLocal`.
 * - **Pass the unescaped element value.** `+` is the EDIFACT data element separator, so an
 *   interchange transmits `+02` as `?+02`. Remove the release character first:
 *   `"202406151430?+02"` returns `""`.
 * - Seconds are always written in the result, `00` for `205` and `303`. Fields are checked, not
 *   clamped: hour 24, second 60 and 29 February 2023 return `""`.
 * - A two-digit year (`206`, `207`, `301`, `302`) is not read.
 * - Returns `""` for any other code, a code of another kind included (`203` is read by
 *   `parseEdifactDateTime`), and for a non-string argument.
 *
 * @param value The data element 2380 value, unescaped (e.g. "202406151430+0200")
 * @param format The data element 2379 format code
 * @returns the date-time with its offset as `YYYY-MM-DDTHH:MM:SS±HH:MM`, or "" on invalid input
 *
 * @example parseEdifactOffsetDateTime("202406151430+0200", "205") // "2024-06-15T14:30:00+02:00"
 * @example parseEdifactOffsetDateTime("20240615143045+0530", "208") // "2024-06-15T14:30:45+05:30"
 * @example parseEdifactOffsetDateTime("202406151430+02", "303") // "2024-06-15T14:30:00+02:00"
 * @example parseEdifactOffsetDateTime("20240615143045-05", "304") // "2024-06-15T14:30:45-05:00"
 * @example parseEdifactOffsetDateTime("202406151430UTC", "303") // "2024-06-15T14:30:00+00:00"
 * @example parseEdifactOffsetDateTime("202406151430GMT", "303") // "2024-06-15T14:30:00+00:00"
 * @example parseEdifactOffsetDateTime("202406151430CET", "303") // "" (an abbreviation names no offset)
 * @example parseEdifactOffsetDateTime("202406151430+24", "303") // "" (not a signed hour)
 * @example parseEdifactOffsetDateTime("202406151430?+02", "303") // "" (the release character is the caller's to remove)
 * @example parseEdifactOffsetDateTime("202406151430", "203") // "" (a local code: use parseEdifactDateTime)
 */
export function parseEdifactOffsetDateTime(
  value: string,
  format: EdifactOffsetDateTimeFormat,
): string {
  try {
    return readEdiValue("edifact", "offsetDateTime", format, value);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
