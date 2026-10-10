import type { EdifactDateTimePeriodFormat } from "../../types/edi";
import { parseEdifactDateTimePeriod } from "../parse/parseEdifactDateTimePeriod";

/**
 * Return true when `value` is a UN/EDIFACT `DTM` value (data element 2380) that states a period
 * between two real local date-times, in a date-time period format code (data element 2379).
 *
 * ### Format code
 * | Code | Mask | The directory's description |
 * |---|---|---|
 * | `719` | `CCYYMMDDHHMM-CCYYMMDDHHMM` | "A period of time which includes the century, year, month, day, hour and minute. Format of period to be given in actual message without hyphen." |
 *
 * - True exactly when `parseEdifactDateTimePeriod` returns a period for the same arguments: the
 *   validator calls the parser, so the two cannot disagree.
 * - A period is valid in its wire form only, with no hyphen.
 * - A period whose end precedes its start is false; an end equal to its start is true.
 * - Checks the calendar as well as the shape: hour 24 and 29 February 2023 are false.
 * - False for any other code, a code of another kind included; check a code alone with
 *   `isValidEdifactDtmFormat`. False for a non-string argument.
 *
 * @param value The data element 2380 value (e.g. "202406151430202406201600")
 * @param format The data element 2379 format code
 * @returns boolean indicating validity
 *
 * @example isValidEdifactDateTimePeriod("202406151430202406201600", "719") // true
 * @example isValidEdifactDateTimePeriod("202406151430-202406201600", "719") // false (a period is transmitted without a hyphen)
 * @example isValidEdifactDateTimePeriod("202406151431202406151430", "719") // false (the end precedes the start)
 * @example isValidEdifactDateTimePeriod("202406151430", "719") // false (one date-time)
 */
export function isValidEdifactDateTimePeriod(
  value: string,
  format: EdifactDateTimePeriodFormat,
): boolean {
  return parseEdifactDateTimePeriod(value, format) !== null;
}
