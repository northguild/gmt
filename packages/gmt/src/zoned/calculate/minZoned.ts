import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";
import { zonedDateTimeFrom } from "../../internal";

/**
 * Return the earliest (minimum) of the given ZonedDateTime values.
 *
 * - Returns null if the array is empty or contains no valid dates.
 * - Validation is performed on each item in the array.
 *
 * @param zonedDateTimes Array of ISO ZonedDateTime strings
 * @returns The earliest zoned datetime string, or null on invalid input
 *
 * @example minZoned(["2024-03-10T12:00:00[America/New_York]", "2024-03-15T12:00:00[America/New_York]"]) // "2024-03-10T12:00:00-04:00[America/New_York]"
 * @example minZoned(["invalid", "2024-03-15T12:00:00[America/New_York]"]) // "2024-03-15T12:00:00-04:00[America/New_York]"
 * @example minZoned(["invalid", "also invalid"]) // null
 * @example minZoned([]) // null
 */
export function minZoned(zonedDateTimes: string[]): string | null {
  try {
    if (!Array.isArray(zonedDateTimes) || !zonedDateTimes.length) return null;

    const valid = zonedDateTimes.filter(isValidZonedDateTime);
    if (!valid.length) return null;

    try {
      const min = valid.reduce((currentMin, candidateStr) => {
        const candidate = zonedDateTimeFrom(candidateStr);
        return Temporal.ZonedDateTime.compare(candidate, currentMin) < 0
          ? candidate
          : currentMin;
      }, zonedDateTimeFrom(valid[0]));

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
