import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";

/**
 * Return true when `value1` is strictly before `value2` for PlainDate values.
 *
 * - Uses Temporal.PlainDate.compare to compare dates.
 * - Returns false if either input is invalid.
 *
 * @param value1 ISO PlainDate string for the first value
 * @param value2 ISO PlainDate string for the second value
 * @returns boolean indicating whether value1 < value2
 *
 * @example isBeforeDate("2024-02-28", "2024-02-29") // true
 * @example isBeforeDate("2024-02-29", "2024-02-29") // false
 * @example isBeforeDate("2024-02-29", "2024-02-28") // false
 * @example isBeforeDate("invalid", "2024-02-29") // false
 * @example isBeforeDate("2024-02-29", "invalid") // false
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
