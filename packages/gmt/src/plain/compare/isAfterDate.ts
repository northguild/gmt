import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "../validate";

/**
 * Return true if the first ISO PlainDate string represents a date after the second.
 *
 * - Uses Temporal.PlainDate.compare to compare dates.
 * - Returns false if either input is invalid.
 *
 * @param value1 first ISO PlainDate string
 * @param value2 second ISO PlainDate string
 * @returns boolean indicating whether value1 is after value2
 *
 * @example isAfterDate("2024-03-01", "2024-02-29") // true
 * @example isAfterDate("2024-02-28", "2024-02-29") // false
 * @example isAfterDate("invalid", "2024-02-29") // false
 * @example isAfterDate("2024-02-29", "invalid") // false
 */
export function isAfterDate(value1: string, value2: string): boolean {
  if (!isValidDate(value1) || !isValidDate(value2)) {
    return false;
  }

  try {
    return (
      Temporal.PlainDate.compare(
        Temporal.PlainDate.from(value1),
        Temporal.PlainDate.from(value2),
      ) === 1
    );
  } catch {
    return false;
  }
}
