import { plainDateOf } from "../../internal/inputChecks";
import { Temporal } from "../../internal/temporal";

/**
 * Return the latest (maximum) of the given PlainDate values.
 *
 * - Returns null if the array is empty or contains no valid dates.
 * - Validation is performed on each item in the array.
 *
 * @param dates Array of ISO PlainDate strings (e.g. "2024-03-10")
 * @returns The latest date string, or null on invalid input
 *
 * @example maxDate(["2024-03-10", "2024-03-15", "2024-03-12"]) // "2024-03-15"
 * @example maxDate([]) // null
 */
export function maxDate(dates: string[]): string | null {
  try {
    if (!Array.isArray(dates) || !dates.length) return null;

    const valid: Temporal.PlainDate[] = [];
    dates.forEach((item) => {
      const parsed = plainDateOf(item);
      if (parsed !== null) valid.push(parsed);
    });
    if (!valid.length) return null;

    try {
      const max = valid.reduce((currentMax, candidate) => {
        return Temporal.PlainDate.compare(candidate, currentMax) > 0
          ? candidate
          : currentMax;
      }, valid[0]);

      return max.toString();
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
