import { plainTimeOf } from "../../internal/inputChecks";
import { Temporal } from "../../internal/temporal";

/**
 * Return true when `value1` is strictly before `value2` for PlainTime values.
 *
 * - Uses Temporal.PlainTime.compare to compare times.
 * - Returns false if either input is invalid.
 *
 * @param value1 ISO PlainTime string for the first value
 * @param value2 ISO PlainTime string for the second value
 * @returns boolean indicating whether value1 < value2
 *
 * @example isBeforeTime("12:34:56", "13:34:56") // true
 * @example isBeforeTime("12:34:56", "12:34:56") // false
 * @example isBeforeTime("13:34:56", "12:34:56") // false
 * @example isBeforeTime("invalid", "12:34:56") // false
 * @example isBeforeTime("12:34:56", "invalid") // false
 */
export function isBeforeTime(value1: string, value2: string): boolean {
  const value1Parsed = plainTimeOf(value1);
  const value2Parsed = plainTimeOf(value2);
  if (value1Parsed === null || value2Parsed === null) {
    return false;
  }

  try {
    return Temporal.PlainTime.compare(value1Parsed, value2Parsed) === -1;
  } catch {
    return false;
  }
}
