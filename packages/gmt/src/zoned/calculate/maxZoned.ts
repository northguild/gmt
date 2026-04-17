import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the latest (maximum) of the given ZonedDateTime values.
 *
 * - Returns null if the array is empty or contains no valid dates.
 * - Validation is performed on each item in the array.
 *
 * @param zonedDateTimes Array of ISO ZonedDateTime strings
 * @returns The latest zoned datetime string, or null on invalid input
 *
 * @example maxZoned(["2024-03-10T12:00:00[America/New_York]", "2024-03-15T12:00:00[America/New_York]"]) // "2024-03-15T12:00:00-04:00[America/New_York]"
 * @example maxZoned(["invalid", "2024-03-15T12:00:00[America/New_York]"]) // "2024-03-15T12:00:00-04:00[America/New_York]"
 * @example maxZoned(["invalid", "also invalid"]) // null
 * @example maxZoned([]) // null
 */
export function maxZoned(zonedDateTimes: string[]): string | null {
  if (!zonedDateTimes.length) return null;

  const valid = zonedDateTimes.filter(isValidZonedDateTime);
  if (!valid.length) return null;

  try {
    const max = valid.reduce((currentMax, candidateStr) => {
      const candidate = Temporal.ZonedDateTime.from(candidateStr);
      return Temporal.ZonedDateTime.compare(candidate, currentMax) > 0
        ? candidate
        : currentMax;
    }, Temporal.ZonedDateTime.from(valid[0]));

    return max.toString();
  } catch {
    return null;
  }
}
