import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../validate/isValidUtc";

/**
 * Sort an array of UTC datetime values in ascending or descending order.
 *
 * - Returns empty array if input is empty or contains no valid UTC datetimes.
 * - Validation is performed on each item in the array.
 *
 * @param utcDateTimes Array of ISO datetime strings (e.g. "2024-03-10T12:00:00Z")
 * @param order "asc" for ascending (earliest first) | "desc" for descending (latest first)
 * @returns Sorted array of UTC datetime strings
 */
export function sortUtc(
  utcDateTimes: string[],
  order: "asc" | "desc" = "asc",
): string[] {
  if (!utcDateTimes.length) return [];

  const valid = utcDateTimes.filter(isValidUtc);
  if (!valid.length) return [];

  const comparables = valid.map((d) => Temporal.Instant.from(d));
  comparables.sort(Temporal.Instant.compare);

  if (order === "desc") {
    return comparables.reverse().map((d) => d.toString());
  }

  return comparables.map((d) => d.toString());
}
