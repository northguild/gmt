import { plainDateTimeOf } from "../../internal/inputChecks";
import { Temporal } from "../../internal/temporal";

/**
 * Return the earliest (minimum) of the given PlainDateTime values.
 *
 * - Returns null if the array is empty or contains no valid datetimes.
 * - Validation is performed on each item in the array.
 *
 * @param dateTimes Array of ISO PlainDateTime strings (e.g. "2024-03-10T12:00:00")
 * @returns The earliest datetime string, or null on invalid input
 *
 * @example minDateTime(["2024-03-10T12:00:00", "2024-03-15T12:00:00", "2024-03-12T12:00:00"]) // "2024-03-10T12:00:00"
 * @example minDateTime([]) // null
 */
export function minDateTime(dateTimes: string[]): string | null {
  try {
    if (!Array.isArray(dateTimes) || !dateTimes.length) return null;

    const valid: Temporal.PlainDateTime[] = [];
    dateTimes.forEach((item) => {
      const parsed = plainDateTimeOf(item);
      if (parsed !== null) valid.push(parsed);
    });
    if (!valid.length) return null;

    try {
      const min = valid.reduce((currentMin, candidate) => {
        return Temporal.PlainDateTime.compare(candidate, currentMin) < 0
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
