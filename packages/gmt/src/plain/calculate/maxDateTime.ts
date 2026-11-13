import { plainDateTimeOf } from "../../internal/inputChecks";
import { Temporal } from "../../internal/temporal";

/**
 * Return the latest (maximum) of the given PlainDateTime values.
 *
 * - Returns null if the array is empty or contains no valid datetimes.
 * - Validation is performed on each item in the array.
 *
 * @param dateTimes Array of ISO PlainDateTime strings (e.g. "2024-03-10T12:00:00")
 * @returns The latest datetime string, or null on invalid input
 *
 * @example maxDateTime(["2024-03-10T12:00:00", "2024-03-15T12:00:00", "2024-03-12T12:00:00"]) // "2024-03-15T12:00:00"
 * @example maxDateTime([]) // null
 */
export function maxDateTime(dateTimes: string[]): string | null {
  try {
    if (!Array.isArray(dateTimes) || !dateTimes.length) return null;

    const valid: Temporal.PlainDateTime[] = [];
    dateTimes.forEach((item) => {
      const parsed = plainDateTimeOf(item);
      if (parsed !== null) valid.push(parsed);
    });
    if (!valid.length) return null;

    try {
      const max = valid.reduce((currentMax, candidate) => {
        return Temporal.PlainDateTime.compare(candidate, currentMax) > 0
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
