import type { EdifactDatePeriodFormat } from "../../types/edi";
import { parseEdifactDatePeriod } from "../parse/parseEdifactDatePeriod";

/**
 * Return true when `value` is a UN/EDIFACT `DTM` value (data element 2380) that states a period
 * between two real calendar dates, in a date period format code (data element 2379).
 *
 * ### Format code
 * | Code | Mask | The directory's description |
 * |---|---|---|
 * | `718` | `CCYYMMDD-CCYYMMDD` | "A period of time specified by giving the start date followed by the end date (both including century). Data is to be transmitted as consecutive characters without hyphen." |
 *
 * - True exactly when `parseEdifactDatePeriod` returns a period for the same arguments: the
 *   validator calls the parser, so the two cannot disagree.
 * - A period is valid in its wire form only, with no hyphen: `"20240615-20240620"` is false.
 * - A period whose end precedes its start is false; an end equal to its start is true.
 * - Checks the calendar as well as the shape: 29 February 2023 in either date is false.
 * - False for any other code, a code of another kind included; check a code alone with
 *   `isValidEdifactDtmFormat`. False for a non-string argument.
 *
 * @param value The data element 2380 value (e.g. "2024061520240620")
 * @param format The data element 2379 format code
 * @returns boolean indicating validity
 *
 * @example isValidEdifactDatePeriod("2024061520240620", "718") // true
 * @example isValidEdifactDatePeriod("20240615-20240620", "718") // false (a period is transmitted without a hyphen)
 * @example isValidEdifactDatePeriod("2024062020240615", "718") // false (the end precedes the start)
 * @example isValidEdifactDatePeriod("20240615", "718") // false (one date)
 */
export function isValidEdifactDatePeriod(
  value: string,
  format: EdifactDatePeriodFormat,
): boolean {
  return parseEdifactDatePeriod(value, format) !== null;
}
