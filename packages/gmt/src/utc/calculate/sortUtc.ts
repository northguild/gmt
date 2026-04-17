import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../validate/isValidUtc";

/**
 * Sort an array of UTC datetime values in ascending or descending order.
 *
 * - Filters invalid values before sorting.
 * - Supports "asc" (earliest first) or "desc" (latest first).
 * - Returns [] if array is empty or has no valid values.
 *
 * @param utcDateTimes Array of ISO datetime strings (e.g. "2024-03-10T12:00:00Z")
 * @param order "asc" for ascending (earliest first) | "desc" for descending (latest first)
 * @returns Sorted array of UTC datetime strings
 *
 * @example sortUtc(["2024-03-12T12:00:00Z", "2024-03-10T12:00:00Z", "2024-03-15T12:00:00Z"]) // ["2024-03-10T12:00:00Z", "2024-03-12T12:00:00Z", "2024-03-15T12:00:00Z"]
 * @example sortUtc(["2024-03-12T12:00:00Z", "2024-03-10T12:00:00Z", "2024-03-15T12:00:00Z"], "desc") // ["2024-03-15T12:00:00Z", "2024-03-12T12:00:00Z", "2024-03-10T12:00:00Z"]
 * @example sortUtc(["invalid", "2024-03-10T12:00:00Z", "also invalid"]) // ["2024-03-10T12:00:00Z"]
 * @example sortUtc([]) // []
 */
export function sortUtc(
  utcDateTimes: string[],
  order: "asc" | "desc" = "asc",
): string[] {
  if (!utcDateTimes.length) return [];

  const valid = utcDateTimes.filter(isValidUtc);
  if (!valid.length) return [];

  try {
    const comparables = valid.map((d) => Temporal.Instant.from(d));
    comparables.sort(Temporal.Instant.compare);

    if (order === "desc") {
      return comparables.reverse().map((d) => d.toString());
    }

    return comparables.map((d) => d.toString());
  } catch {
    return [];
  }
}
