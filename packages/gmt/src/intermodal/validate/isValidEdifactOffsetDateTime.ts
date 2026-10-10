import type { EdifactOffsetDateTimeFormat } from "../../types/edi";
import { parseEdifactOffsetDateTime } from "../parse/parseEdifactOffsetDateTime";

/**
 * Return true when `value` is a UN/EDIFACT `DTM` value (data element 2380) that states a real
 * date and time with an offset from UTC, in a format code that carries one (data element 2379).
 *
 * ### Format codes
 * | Code | Mask | The directory's description |
 * |---|---|---|
 * | `205` | `CCYYMMDDHHMMZHHMM` | "Calendar date including time and time zone expressed in hours and minutes." |
 * | `208` | `CCYYMMDDHHMMSSZHHMM` | "Calendar date including time with seconds, with Time Zone" (D.12A and later) |
 * | `303` | `CCYYMMDDHHMMZZZ` | "See 203 plus Z=Time zone." |
 * | `304` | `CCYYMMDDHHMMSSZZZ` | "See 204 plus Z=Time zone." |
 *
 * - True exactly when `parseEdifactOffsetDateTime` returns a value for the same arguments: the
 *   validator calls the parser, so the two cannot disagree.
 * - The three `ZZZ` characters of `303` and `304` are valid only as an offset: a signed hour
 *   from `00` to `23`, `UTC` or `GMT`. An abbreviation such as `CET`, a broken offset (`+24`)
 *   and a lone `Z` are false.
 * - Takes the unescaped element value: `"202406151430?+02"` is false.
 * - Checks the calendar as well as the shape: 29 February 2023, hour 24 and second 60 are
 *   false.
 * - False for any other code, a code of another kind included; check a code alone with
 *   `isValidEdifactDtmFormat`. False for a non-string argument.
 *
 * @param value The data element 2380 value, unescaped (e.g. "202406151430+0200")
 * @param format The data element 2379 format code
 * @returns boolean indicating validity
 *
 * @example isValidEdifactOffsetDateTime("202406151430+0200", "205") // true
 * @example isValidEdifactOffsetDateTime("20240615143045+0530", "208") // true
 * @example isValidEdifactOffsetDateTime("202406151430UTC", "303") // true
 * @example isValidEdifactOffsetDateTime("20240615143045-05", "304") // true
 * @example isValidEdifactOffsetDateTime("202406151430CET", "303") // false (an abbreviation names no offset)
 * @example isValidEdifactOffsetDateTime("202406151430", "205") // false (no offset)
 */
export function isValidEdifactOffsetDateTime(
  value: string,
  format: EdifactOffsetDateTimeFormat,
): boolean {
  return parseEdifactOffsetDateTime(value, format) !== "";
}
