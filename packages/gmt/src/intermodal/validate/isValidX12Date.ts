import type { X12DateFormat } from "../../types/edi";
import { parseX12Date } from "../parse/parseX12Date";

/**
 * Return true when `value` is an X12 Date Time Period value (data element 1251) that states a
 * real calendar date in a date format qualifier (data element 1250).
 *
 * ### Format codes
 * | Code | Mask | The dictionary's definition |
 * |---|---|---|
 * | `D8` | `CCYYMMDD` | "Date Expressed in Format CCYYMMDD" |
 * | `DB` | `MMDDCCYY` | "Date Expressed in Format MMDDCCYY" |
 *
 * - True exactly when `parseX12Date` returns a date for the same arguments: the validator calls
 *   the parser, so the two cannot disagree.
 * - A value is valid only against its code: `"06152024"` is a `DB` value and not a `D8` one.
 * - Checks the calendar as well as the shape: 31 June and 29 February 2023 are false.
 * - False for any other code, a code of another kind included; check a code alone with
 *   `isValidX12DateTimePeriodFormat`. False for a non-string argument.
 *
 * @param value The data element 1251 value (e.g. "20240615")
 * @param format X12 data element 1250 format qualifier
 * @returns boolean indicating validity
 *
 * @example isValidX12Date("20240615", "D8") // true
 * @example isValidX12Date("06152024", "DB") // true
 * @example isValidX12Date("06152024", "D8") // false (20 is not a month)
 * @example isValidX12Date("20230229", "D8") // false (2023 has no 29 February)
 */
export function isValidX12Date(value: string, format: X12DateFormat): boolean {
  return parseX12Date(value, format) !== "";
}
