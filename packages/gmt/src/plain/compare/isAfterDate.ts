import { plainDateOf } from "../../internal/inputChecks";
import { Temporal } from "../../internal/temporal";

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
  const value1Parsed = plainDateOf(value1);
  const value2Parsed = value1Parsed === null ? null : plainDateOf(value2);
  if (value1Parsed === null || value2Parsed === null) {
    return false;
  }

  try {
    return Temporal.PlainDate.compare(value1Parsed, value2Parsed) === 1;
  } catch {
    return false;
  }
}
