import { plainDateOf } from "../../internal/inputChecks";
import { Temporal } from "../../internal/temporal";

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
  const value1Parsed = plainDateOf(value1);
  const value2Parsed = value1Parsed === null ? null : plainDateOf(value2);
  if (value1Parsed === null || value2Parsed === null) {
    return false;
  }

  try {
    return Temporal.PlainDate.compare(value1Parsed, value2Parsed) === -1;
  } catch {
    return false;
  }
}
