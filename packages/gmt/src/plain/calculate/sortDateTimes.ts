import { plainDateTimeOf } from "../../internal/inputChecks";
import { Temporal } from "../../internal/temporal";

/**
 * Sort an array of PlainDateTime values in ascending or descending order.
 *
 * - Returns empty array if no valid datetimes.
 * - Validation is performed on each item in the array.
 *
 * @param dateTimes Array of ISO PlainDateTime strings (e.g. "2024-03-10T12:00:00")
 * @param order "asc" for ascending (earliest first) | "desc" for descending (latest first)
 * @returns Sorted array of datetime strings
 *
 * @example sortDateTimes(["2024-03-10T12:00:00", "2024-01-01T08:00:00", "2024-02-15T15:30:00"]) // ["2024-01-01T08:00:00", "2024-02-15T15:30:00", "2024-03-10T12:00:00"]
 * @example sortDateTimes([]) // []
 */
export function sortDateTimes(
  dateTimes: string[],
  order: "asc" | "desc" = "asc",
): string[] {
  try {
    if (!Array.isArray(dateTimes) || !dateTimes.length) return [];

    const valid: Temporal.PlainDateTime[] = [];
    dateTimes.forEach((item) => {
      const parsed = plainDateTimeOf(item);
      if (parsed !== null) valid.push(parsed);
    });
    if (!valid.length) return [];

    try {
      const comparables = valid;
      comparables.sort(Temporal.PlainDateTime.compare);

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
