import type { EdifactDateFormat } from "../../types/edi";
import { parseEdifactDate } from "../parse/parseEdifactDate";

/**
 * Return true when `value` is a UN/EDIFACT `DTM` value (data element 2380) that states a real
 * calendar date in a date format code (data element 2379).
 *
 * ### Format code
 * | Code | Mask | The directory's description |
 * |---|---|---|
 * | `102` | `CCYYMMDD` | "Calendar date: C = Century ; Y = Year ; M = Month ; D = Day." |
 *
 * - True exactly when `parseEdifactDate` returns a date for the same arguments: the validator
 *   calls the parser, so the two cannot disagree.
 * - Checks the calendar as well as the shape: 31 June and 29 February 2023 are false.
 * - False for any other code, a code of another kind included; check a code alone with
 *   `isValidEdifactDtmFormat`. False for a non-string argument.
 *
 * @param value The data element 2380 value (e.g. "20240615")
 * @param format The data element 2379 format code
 * @returns boolean indicating validity
 *
 * @example isValidEdifactDate("20240615", "102") // true
 * @example isValidEdifactDate("20230229", "102") // false (2023 has no 29 February)
 * @example isValidEdifactDate("240615", "102") // false (a two-digit year is not read)
 * @example isValidEdifactDate("202406151430", "203") // false (a date-time code)
 */
export function isValidEdifactDate(
  value: string,
  format: EdifactDateFormat,
): boolean {
  return parseEdifactDate(value, format) !== "";
}
