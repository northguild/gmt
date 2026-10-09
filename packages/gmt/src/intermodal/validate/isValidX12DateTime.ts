import type { X12DateTimeFormat } from "../../types/edi";
import { parseX12DateTime } from "../parse/parseX12DateTime";

/**
 * Return true when `value` is an X12 Date Time Period value (data element 1251) that states a
 * real date and time in a date-time format qualifier (data element 1250).
 *
 * ### Format codes
 * | Code | Mask | The dictionary's definition |
 * |---|---|---|
 * | `DT` | `CCYYMMDDHHMM` | "Date and Time Expressed in Format CCYYMMDDHHMM" |
 * | `RTS` | `CCYYMMDDHHMMSS` | "Date and Time Expressed in Format CCYYMMDDHHMMSS" |
 *
 * - True exactly when `parseX12DateTime` returns a date-time for the same arguments: the
 *   validator calls the parser, so the two cannot disagree.
 * - A value is valid only against its code: `"202406151430"` is a `DT` value and not an `RTS`
 *   one.
 * - Checks the calendar as well as the shape: 31 June, 29 February 2023, hour 24 and second 60
 *   are false.
 * - False for any other code, a code of another kind included; check a code alone with
 *   `isValidX12DateTimePeriodFormat`. False for a non-string argument.
 *
 * @param value The data element 1251 value (e.g. "202406151430")
 * @param format X12 data element 1250 format qualifier
 * @returns boolean indicating validity
 *
 * @example isValidX12DateTime("202406151430", "DT") // true
 * @example isValidX12DateTime("20240615143045", "RTS") // true
 * @example isValidX12DateTime("202406151430", "RTS") // false (twelve digits is a DT value)
 * @example isValidX12DateTime("202406152430", "DT") // false (hour 24)
 */
export function isValidX12DateTime(
  value: string,
  format: X12DateTimeFormat,
): boolean {
  return parseX12DateTime(value, format) !== "";
}
