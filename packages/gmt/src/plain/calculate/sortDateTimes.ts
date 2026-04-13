import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate";

/**
 * Sort an array of PlainDateTime values in ascending or descending order.
 *
 * - Returns empty array if input is empty or contains no valid datetimes.
 * - Validation is performed on each item in the array.
 *
 * @param dateTimes Array of ISO PlainDateTime strings (e.g. "2024-03-10T12:00:00")
 * @param order "asc" for ascending (earliest first) | "desc" for descending (latest first)
 * @example sortDateTimes(["2024-03-10T12:00:00", "2024-01-01T08:00:00", "2024-02-15T15:30:00"]) // ["2024-01-01T08:00:00", "2024-02-15T15:30:00", "2024-03-10T12:00:00"]
 * @example sortDateTimes(["2024-03-10T12:00:00", "2024-01-01T08:00:00", "2024-02-15T15:30:00"], "desc") // ["2024-03-10T12:00:00", "2024-02-15T15:30:00", "2024-01-01T08:00:00"]
 * @example sortDateTimes(["invalid", "2024-01-01T08:00:00"]) // ["2024-01-01T08:00:00"]
 * @example sortDateTimes([]) // []
 * @returns Sorted array of datetime strings
 */
export function sortDateTimes(
  dateTimes: string[],
  order: "asc" | "desc" = "asc",
): string[] {
  if (!dateTimes.length) return [];

  const valid = dateTimes.filter(isValidDateTime);
  if (!valid.length) return [];

  const comparables = valid.map((d) => Temporal.PlainDateTime.from(d));
  comparables.sort(Temporal.PlainDateTime.compare);

  if (order === "desc") {
    return comparables.reverse().map((d) => d.toString());
  }

  return comparables.map((d) => d.toString());
}
