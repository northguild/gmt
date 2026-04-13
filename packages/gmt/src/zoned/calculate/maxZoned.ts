import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the latest (maximum) of the given ZonedDateTime values.
 *
 * - Returns null if the array is empty or contains no valid zoned datetimes.
 * - Validation is performed on each item in the array.
 *
 * @param zonedDateTimes Array of ISO ZonedDateTime strings (e.g. "2024-03-10T12:00:00[America/New_York]")
 * @example maxZoned(["2024-03-10T12:00:00[America/New_York]", "2024-03-15T12:00:00[America/New_York]"]) // "2024-03-15T12:00:00-04:00[America/New_York]"
 * @example maxZoned(["invalid", "2024-03-15T12:00:00[America/New_York]"]) // "2024-03-15T12:00:00-04:00[America/New_York]"
 * @example maxZoned(["invalid", "also invalid"]) // null
 * @example maxZoned([]) // null
 * @returns The latest zoned datetime string, or null on invalid input
 */
export function maxZoned(zonedDateTimes: string[]): string | null {
  if (!zonedDateTimes.length) return null;

  const valid = zonedDateTimes.filter(isValidZonedDateTime);
  if (!valid.length) return null;

  const comparables = valid.map((d) => Temporal.ZonedDateTime.from(d));
  comparables.sort(Temporal.ZonedDateTime.compare);

  return comparables[comparables.length - 1].toString();
}
