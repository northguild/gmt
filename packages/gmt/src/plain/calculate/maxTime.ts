import { plainTimeOf } from "../../internal/inputChecks";
import { Temporal } from "../../internal/temporal";

/**
 * Return the latest (maximum) of the given PlainTime values.
 *
 * - Returns null if the array is empty or contains no valid times.
 * - Validation is performed on each item in the array.
 *
 * @param times Array of ISO PlainTime strings (e.g. "14:30:00")
 * @returns The latest time string, or null on invalid input
 *
 * @example maxTime(["14:30:00", "09:00:00", "20:45:00"]) // "20:45:00"
 * @example maxTime([]) // null
 */
export function maxTime(times: string[]): string | null {
  try {
    if (!Array.isArray(times) || !times.length) return null;

    const valid: Temporal.PlainTime[] = [];
    times.forEach((item) => {
      const parsed = plainTimeOf(item);
      if (parsed !== null) valid.push(parsed);
    });
    if (!valid.length) return null;

    try {
      const max = valid.reduce((currentMax, candidate) => {
        return Temporal.PlainTime.compare(candidate, currentMax) > 0
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
