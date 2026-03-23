import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";

/**
 * Return true when `value1` is strictly before `value2` for PlainDate values.
 *
 * - Validates inputs and then compares using Temporal.PlainDate.compare.
 * - Returns false for invalid inputs.
 *
 * @param value1 ISO PlainDate string for the first value
 * @param value2 ISO PlainDate string for the second value
 * @returns boolean indicating whether value1 < value2
 */
export function isBeforeDate(value1: string, value2: string): boolean {
  if (!isValidDate(value1) || !isValidDate(value2)) {
    return false;
  }

  try {
    return (
      Temporal.PlainDate.compare(
        Temporal.PlainDate.from(value1),
        Temporal.PlainDate.from(value2),
      ) === -1
    );
  } catch {
    return false;
  }
}
