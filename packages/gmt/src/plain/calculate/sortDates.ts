import { plainDateOf } from "../../internal/inputChecks";
import { Temporal } from "../../internal/temporal";

/**
 * Sort an array of PlainDate values in ascending or descending order.
 *
 * - Returns empty array if no valid dates.
 * - Validation is performed on each item in the array.
 *
 * @param dates Array of ISO PlainDate strings (e.g. "2024-03-10")
 * @param order "asc" for ascending (earliest first) | "desc" for descending (latest first)
 * @returns Sorted array of date strings
 *
 * @example sortDates(["2024-03-10", "2024-01-01", "2024-02-15"]) // ["2024-01-01", "2024-02-15", "2024-03-10"]
 * @example sortDates([]) // []
 */
export function sortDates(
  dates: string[],
  order: "asc" | "desc" = "asc",
): string[] {
  try {
    if (!Array.isArray(dates) || !dates.length) return [];

    const valid: Temporal.PlainDate[] = [];
    dates.forEach((item) => {
      const parsed = plainDateOf(item);
      if (parsed !== null) valid.push(parsed);
    });
    if (!valid.length) return [];

    try {
      const comparables = valid;
      comparables.sort(Temporal.PlainDate.compare);

      if (order === "desc") {
        return comparables.reverse().map((d) => d.toString());
      }

      return comparables.map((d) => d.toString());
    } catch {
      return [];
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return [];
  }
}
