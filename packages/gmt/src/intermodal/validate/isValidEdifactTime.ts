import type { EdifactTimeFormat } from "../../types/edi";
import { parseEdifactTime } from "../parse/parseEdifactTime";

/**
 * Return true when `value` is a UN/EDIFACT `DTM` value (data element 2380) that states a real
 * time of day in a time format code (data element 2379).
 *
 * ### Format codes
 * | Code | Mask | The directory's description |
 * |---|---|---|
 * | `401` | `HHMM` | "Time without seconds: H = Hour; m = Minute." |
 * | `402` | `HHMMSS` | "Time with seconds: H = Hour; m = Minute; s = Seconds." |
 *
 * - True exactly when `parseEdifactTime` returns a time for the same arguments: the validator
 *   calls the parser, so the two cannot disagree.
 * - A value is valid only against its code: `"1430"` is a `401` value and not a `402` one.
 * - Hour 24, minute 60 and second 60 are false.
 * - False for any other code, a code of another kind included; check a code alone with
 *   `isValidEdifactDtmFormat`. False for a non-string argument.
 *
 * @param value The data element 2380 value (e.g. "1430")
 * @param format The data element 2379 format code
 * @returns boolean indicating validity
 *
 * @example isValidEdifactTime("1430", "401") // true
 * @example isValidEdifactTime("143045", "402") // true
 * @example isValidEdifactTime("1430", "402") // false (four digits is a 401 value)
 * @example isValidEdifactTime("2400", "401") // false (hour 24)
 */
export function isValidEdifactTime(
  value: string,
  format: EdifactTimeFormat,
): boolean {
  return parseEdifactTime(value, format) !== "";
}
