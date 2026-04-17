import { Temporal } from "@js-temporal/polyfill";
import { isValidTime } from "../validate";

/**
 * Sort an array of PlainTime values in ascending or descending order.
 *
 * - Returns empty array if no valid times.
 * - Validation is performed on each item in the array.
 *
 * @param times Array of ISO PlainTime strings (e.g. "14:30:00")
 * @param order "asc" for ascending (earliest first) | "desc" for descending (latest first)
 * @returns Sorted array of time strings
 *
 * @example sortTimes(["14:30:00", "09:00:00", "20:45:00"]) // ["09:00:00", "14:30:00", "20:45:00"]
 * @example sortTimes([]) // []
 */
export function sortTimes(
  times: string[],
  order: "asc" | "desc" = "asc",
): string[] {
  if (!times.length) return [];

  const valid = times.filter(isValidTime);
  if (!valid.length) return [];

  try {
    const comparables = valid.map((t) => Temporal.PlainTime.from(t));
    comparables.sort(Temporal.PlainTime.compare);

    if (order === "desc") {
      return comparables.reverse().map((t) => t.toString());
    }

    return comparables.map((t) => t.toString());
  } catch {
    return [];
  }
}
