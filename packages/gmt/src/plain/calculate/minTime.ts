import { plainTimeOf } from "../../internal/inputChecks";
import { Temporal } from "../../internal/temporal";

/**
 * Return the earliest (minimum) of the given PlainTime values.
 *
 * - Returns null if the array is empty or contains no valid times.
 * - Validation is performed on each item in the array.
 *
 * @param times Array of ISO PlainTime strings (e.g. "14:30:00")
 * @returns The earliest time string, or null on invalid input
 *
 * @example minTime(["14:30:00", "09:00:00", "20:45:00"]) // "09:00:00"
 * @example minTime([]) // null
 */
export function minTime(times: string[]): string | null {
  try {
    if (!Array.isArray(times) || !times.length) return null;

    const valid: Temporal.PlainTime[] = [];
    times.forEach((item) => {
      const parsed = plainTimeOf(item);
      if (parsed !== null) valid.push(parsed);
    });
    if (!valid.length) return null;

    try {
      const min = valid.reduce((currentMin, candidate) => {
        return Temporal.PlainTime.compare(candidate, currentMin) < 0
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
