import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Sort an array of ZonedDateTime values in ascending or descending order.
 *
 * - Returns empty array if input is empty or contains no valid zoned datetimes.
 * - Validation is performed on each item in the array.
 *
 * @param zonedDateTimes Array of ISO ZonedDateTime strings (e.g. "2024-03-10T12:00:00[America/New_York]")
 * @param order "asc" for ascending (earliest first) | "desc" for descending (latest first)
 * @example sortZoned(["2024-03-10T12:00:00[America/New_York]", "2024-01-01T08:00:00[America/New_York]", "2024-02-15T15:30:00[America/New_York]"]) // ["2024-01-01T08:00:00-05:00[America/New_York]", "2024-02-15T15:30:00-05:00[America/New_York]", "2024-03-10T12:00:00-04:00[America/New_York]"]
 * @example sortZoned(["2024-03-10T12:00:00[America/New_York]", "2024-01-01T08:00:00[America/New_York]", "2024-02-15T15:30:00[America/New_York]"], "desc") // ["2024-03-10T12:00:00-04:00[America/New_York]", "2024-02-15T15:30:00-05:00[America/New_York]", "2024-01-01T08:00:00-05:00[America/New_York]"]
 * @example sortZoned(["invalid", "2024-01-01T08:00:00[America/New_York]", "2024-02-15T15:30:00[America/New_York]"]) // ["2024-01-01T08:00:00-05:00[America/New_York]", "2024-02-15T15:30:00-05:00[America/New_York]"]
 * @example sortZoned([]) // []
 * @returns Sorted array of zoned datetime strings
 */
export function sortZoned(
  zonedDateTimes: string[],
  order: "asc" | "desc" = "asc",
): string[] {
  if (!zonedDateTimes.length) return [];

  const valid = zonedDateTimes.filter(isValidZonedDateTime);
  if (!valid.length) return [];

  const comparables = valid.map((d) => Temporal.ZonedDateTime.from(d));
  comparables.sort(Temporal.ZonedDateTime.compare);

  if (order === "desc") {
    return comparables.reverse().map((d) => d.toString());
  }

  return comparables.map((d) => d.toString());
}
