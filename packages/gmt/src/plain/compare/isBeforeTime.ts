import { Temporal } from "@js-temporal/polyfill";

import { isValidTime } from "../validate";

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
  if (!isValidTime(value1) || !isValidTime(value2)) {
    return false;
  }

  try {
    return (
      Temporal.PlainTime.compare(
        Temporal.PlainTime.from(value1),
        Temporal.PlainTime.from(value2),
      ) === -1
    );
  } catch {
    return false;
  }
}
