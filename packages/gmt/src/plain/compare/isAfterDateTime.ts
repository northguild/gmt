import { Temporal } from "@js-temporal/polyfill";

import { isValidDateTime } from "../validate";

/**
 * Return true when `value1` is strictly after `value2` for PlainDateTime values.
 *
 * - Uses Temporal.PlainDateTime.compare to compare date-times.
 * - Returns false if either input is invalid.
 *
 * @param value1 ISO PlainDateTime string for the first value
 * @param value2 ISO PlainDateTime string for the second value
 * @returns boolean indicating whether value1 > value2
 *
 * @example isAfterDateTime("2024-02-29T12:34:56", "2024-02-28T12:34:56") // true
 * @example isAfterDateTime("2024-02-29T12:34:56", "2024-02-29T12:34:56") // false
 * @example isAfterDateTime("2024-02-28T12:34:56", "2024-02-29T12:34:56") // false
 * @example isAfterDateTime("invalid", "2024-02-29T12:34:56") // false
 * @example isAfterDateTime("2024-02-29T12:34:56", "invalid") // false
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
