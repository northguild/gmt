import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the earliest (minimum) of the given ZonedDateTime values.
 *
 * - Returns null if the array is empty or contains no valid zoned datetimes.
 * - Validation is performed on each item in the array.
 *
 * @param zonedDateTimes Array of ISO ZonedDateTime strings (e.g. "2024-03-10T12:00:00[America/New_York]")
 * @example minZoned(["2024-03-10T12:00:00[America/New_York]", "2024-03-15T12:00:00[America/New_York]"]) // "2024-03-10T12:00:00-05:00[America/New_York]"
 * @example minZoned(["invalid", "2024-03-15T12:00:00[America/New_York]"]) // "2024-03-15T12:00:00-04:00[America/New_York]"
 * @example minZoned(["invalid", "also invalid"]) // null
 * @example minZoned([]) // null
 * @returns The earliest zoned datetime string, or null on invalid input
 */
export function minZoned(zonedDateTimes: string[]): string | null {
  if (!zonedDateTimes.length) return null;

  const valid = zonedDateTimes.filter(isValidZonedDateTime);
  if (!valid.length) return null;

  const comparables = valid.map((d) => Temporal.ZonedDateTime.from(d));
  comparables.sort(Temporal.ZonedDateTime.compare);

  return comparables[0].toString();
}
