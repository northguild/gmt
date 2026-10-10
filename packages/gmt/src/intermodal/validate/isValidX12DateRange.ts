import type { X12DateRangeFormat } from "../../types/edi";
import { parseX12DateRange } from "../parse/parseX12DateRange";

/**
 * Return true when `value` is an X12 Date Time Period value (data element 1251) that states a
 * range between two real calendar dates, in a date range format qualifier (data element 1250).
 *
 * ### Format codes
 * | Code | Mask | The dictionary's definition |
 * |---|---|---|
 * | `RD8` | `CCYYMMDD-CCYYMMDD` | "Range of Dates Expressed in Format CCYYMMDD-CCYYMMDD" |
 * | `RD` | `MMDDCCYY-MMDDCCYY` | "Range of Dates Expressed in Format MMDDCCYY-MMDDCCYY" |
 *
 * - True exactly when `parseX12DateRange` returns a range for the same arguments: the validator
 *   calls the parser, so the two cannot disagree.
 * - A range is valid with exactly one hyphen: `"2024061520240620"` is false.
 * - A range whose end precedes its start is false; an end equal to its start is true.
 * - Checks the calendar as well as the shape: 29 February 2023 in either date is false.
 * - False for any other code, a code of another kind included; check a code alone with
 *   `isValidX12DateTimePeriodFormat`. False for a non-string argument.
 *
 * @param value The data element 1251 value (e.g. "20240615-20240620")
 * @param format X12 data element 1250 format qualifier
 * @returns boolean indicating validity
 *
 * @example isValidX12DateRange("20240615-20240620", "RD8") // true
 * @example isValidX12DateRange("06152024-06202024", "RD") // true
 * @example isValidX12DateRange("2024061520240620", "RD8") // false (a range is transmitted with its hyphen)
 * @example isValidX12DateRange("20240620-20240615", "RD8") // false (the end precedes the start)
 */
export function isValidX12DateRange(
  value: string,
  format: X12DateRangeFormat,
): boolean {
  return parseX12DateRange(value, format) !== null;
}
