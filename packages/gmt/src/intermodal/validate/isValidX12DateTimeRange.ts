import type { X12DateTimeRangeFormat } from "../../types/edi";
import { parseX12DateTimeRange } from "../parse/parseX12DateTimeRange";

/**
 * Return true when `value` is an X12 Date Time Period value (data element 1251) that states a
 * range between two real local date-times, in a date-time range format qualifier (data element
 * 1250).
 *
 * ### Format codes
 * | Code | Mask | The dictionary's definition |
 * |---|---|---|
 * | `RDT` | `CCYYMMDDHHMM-CCYYMMDDHHMM` | "Range of Date and Time, Expressed in Format CCYYMMDDHHMM-CCYYMMDDHHMM" |
 * | `DTS` | `CCYYMMDDHHMMSS-CCYYMMDDHHMMSS` | "Range of Date and Time Expressed in Format CCYYMMDDHHMMSS-CCYYMMDDHHMMSS" |
 *
 * - True exactly when `parseX12DateTimeRange` returns a range for the same arguments: the
 *   validator calls the parser, so the two cannot disagree.
 * - A range is valid with exactly one hyphen, and only against its code.
 * - A range whose end precedes its start is false; an end equal to its start is true.
 * - Checks the calendar as well as the shape: hour 24, second 60 and 29 February 2023 are
 *   false.
 * - False for any other code, a code of another kind included; check a code alone with
 *   `isValidX12DateTimePeriodFormat`. False for a non-string argument.
 *
 * @param value The data element 1251 value (e.g. "202406151430-202406201600")
 * @param format X12 data element 1250 format qualifier
 * @returns boolean indicating validity
 *
 * @example isValidX12DateTimeRange("202406151430-202406201600", "RDT") // true
 * @example isValidX12DateTimeRange("20240615143045-20240620160030", "DTS") // true
 * @example isValidX12DateTimeRange("202406151430202406201600", "RDT") // false (a range is transmitted with its hyphen)
 * @example isValidX12DateTimeRange("202406151431-202406151430", "RDT") // false (the end precedes the start)
 */
export function isValidX12DateTimeRange(
  value: string,
  format: X12DateTimeRangeFormat,
): boolean {
  return parseX12DateTimeRange(value, format) !== null;
}
