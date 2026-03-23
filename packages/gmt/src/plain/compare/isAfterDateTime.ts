import { Temporal } from "@js-temporal/polyfill";

import { isValidDateTime } from "../validate";

/**
 * Return true when `value1` is strictly after `value2` for PlainDateTime
 * values.
 *
 * - Validates inputs then uses Temporal.PlainDateTime.compare.
 * - Returns false for invalid inputs.
 *
 * @param value1 ISO PlainDateTime string for the first value
 * @param value2 ISO PlainDateTime string for the second value
 * @returns boolean indicating whether value1 > value2
 */
export function isAfterDateTime(value1: string, value2: string): boolean {
  if (!isValidDateTime(value1) || !isValidDateTime(value2)) {
    return false;
  }

  try {
    return (
      Temporal.PlainDateTime.compare(
        Temporal.PlainDateTime.from(value1),
        Temporal.PlainDateTime.from(value2),
      ) === 1
    );
  } catch {
    return false;
  }
}
