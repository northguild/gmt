import { Temporal } from "@js-temporal/polyfill";

import { isValidTime } from "../validate";

/**
 * Return true when `value1` is strictly before `value2` for PlainTime values.
 *
 * - Validates both inputs then compares using Temporal.PlainTime.compare.
 * - Returns false for invalid inputs.
 *
 * @param value1 ISO PlainTime string for the first value
 * @param value2 ISO PlainTime string for the second value
 * @returns boolean indicating whether value1 < value2
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
