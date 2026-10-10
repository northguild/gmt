import type { X12TimeFormat } from "../../types/edi";
import { parseX12Time } from "../parse/parseX12Time";

/**
 * Return true when `value` is an X12 time that states a real time of day: a data element 337
 * value with no qualifier, or a time that fits the data element 1250 format qualifier it
 * arrived with.
 *
 * ### Forms
 * | `format` | Digits | Mask | The dictionary's definition |
 * |---|---|---|---|
 * | omitted | 4, 6, 7 or 8 | `HHMM`, `HHMMSS`, `HHMMSSD`, `HHMMSSDD` | Element 337: "H = hours (00-23), M = minutes (00-59), S = integer seconds (00-59) … D = tenths (0-9) and DD = hundredths (00-99)" |
 * | `TM` | 4 | `HHMM` | "Time Expressed in Format HHMM" |
 * | `TS` | 6 | `HHMMSS` | "Time Expressed in Format HHMMSS" |
 *
 * - True exactly when `parseX12Time` returns a time for the same arguments: the validator calls
 *   the parser, so the two cannot disagree.
 * - Omit `format` for the time element of a freight segment (`AT7-06`, `G62-04`, `DTM-03`),
 *   which has no qualifier. Pass it for a time that arrives with one (`DTP-02` and `DTP-03`,
 *   `DTM-05` and `DTM-06`).
 * - A qualifier is strict: `"143045"` is false under `TM`, and a 7- or 8-digit value is false
 *   under either qualifier, although all three are true with none.
 * - A `format` that is present and is not `TM` or `TS` is false.
 * - Hour 24, minute 60, second 60 and a value of 5 or 9 digits are false.
 * - False for a non-string value.
 *
 * @param value The time as transmitted (e.g. "1430")
 * @param format X12 data element 1250 format qualifier the time arrived with; omit it for a data element 337 value
 * @returns boolean indicating validity
 *
 * @example isValidX12Time("1430") // true
 * @example isValidX12Time("1430", "TM") // true
 * @example isValidX12Time("143045", "TS") // true
 * @example isValidX12Time("14300012") // true (hundredths of a second)
 * @example isValidX12Time("14300012", "TS") // false (no 1250 code holds decimal seconds)
 * @example isValidX12Time("143045", "TM") // false (six digits is a TS value)
 * @example isValidX12Time("2430") // false (hour 24)
 * @example isValidX12Time("14304") // false (five digits is not an element 337 form)
 */
export function isValidX12Time(value: string, format?: X12TimeFormat): boolean {
  return parseX12Time(value, format) !== "";
}
