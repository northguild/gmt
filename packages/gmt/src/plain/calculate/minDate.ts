import { plainDateOf } from "../../internal/inputChecks";
import { Temporal } from "../../internal/temporal";

/**
 * Return the earliest (minimum) of the given PlainDate values.
 *
 * - Returns null if the array is empty or contains no valid dates.
 * - Validation is performed on each item in the array.
 *
 * @param dates Array of ISO PlainDate strings (e.g. "2024-03-10")
 * @returns The earliest date string, or null on invalid input
 *
 * @example minDate(["2024-03-10", "2024-03-15", "2024-03-12"]) // "2024-03-10"
 * @example minDate([]) // null
 */
export function minDate(dates: string[]): string | null {
  try {
    if (!Array.isArray(dates) || !dates.length) return null;

    const valid: Temporal.PlainDate[] = [];
    dates.forEach((item) => {
      const parsed = plainDateOf(item);
      if (parsed !== null) valid.push(parsed);
    });
    if (!valid.length) return null;

    try {
      const min = valid.reduce((currentMin, candidate) => {
        return Temporal.PlainDate.compare(candidate, currentMin) < 0
          ? candidate
          : currentMin;
      }, valid[0]);

      return min.toString();
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
