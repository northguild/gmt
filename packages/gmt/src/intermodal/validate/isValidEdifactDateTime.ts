import type { EdifactDateTimeFormat } from "../../types/edi";
import { parseEdifactDateTime } from "../parse/parseEdifactDateTime";

/**
 * Return true when `value` is a UN/EDIFACT `DTM` value (data element 2380) that states a real
 * date and time in a format code with no offset (data element 2379).
 *
 * ### Format codes
 * | Code | Mask | The directory's description |
 * |---|---|---|
 * | `203` | `CCYYMMDDHHMM` | "Calendar date including time with minutes" |
 * | `204` | `CCYYMMDDHHMMSS` | "Calendar date including time with seconds" |
 *
 * - True exactly when `parseEdifactDateTime` returns a date-time for the same arguments: the
 *   validator calls the parser, so the two cannot disagree.
 * - A value is valid only against its code: `"202406151430"` is a `203` value and not a `204`
 *   one.
 * - Checks the calendar as well as the shape: 31 June, 29 February 2023, hour 24 and second 60
 *   are false.
 * - False for any other code, a code of another kind included; check a code alone with
 *   `isValidEdifactDtmFormat`. False for a non-string argument.
 *
 * @param value The data element 2380 value (e.g. "202406151430")
 * @param format The data element 2379 format code
 * @returns boolean indicating validity
 *
 * @example isValidEdifactDateTime("202406151430", "203") // true
 * @example isValidEdifactDateTime("20240615143045", "204") // true
 * @example isValidEdifactDateTime("202406151430", "204") // false (twelve digits is a 203 value)
 * @example isValidEdifactDateTime("202302291430", "203") // false (2023 has no 29 February)
 */
export function isValidEdifactDateTime(
  value: string,
  format: EdifactDateTimeFormat,
): boolean {
  return parseEdifactDateTime(value, format) !== "";
}
