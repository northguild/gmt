import { Temporal } from "../../internal/temporal";
import { zonedDateTimesOf } from "../../internal/zonedWallClock";

/**
 * Sort an array of ZonedDateTime values in ascending or descending order.
 *
 * - Invalid dates are filtered out.
 * - Defaults to ascending order (earliest first).
 * - Returns empty array if no valid dates.
 *
 * @param zonedDateTimes Array of ISO ZonedDateTime strings
 * @param order "asc" for ascending (earliest first) | "desc" for descending (latest first)
 * @returns Sorted array of zoned datetime strings
 *
 * @example sortZoned(["2024-03-10T12:00:00[Australia/Sydney]", "2024-01-01T08:00:00[Australia/Sydney]", "2024-02-15T15:30:00[Australia/Sydney]"]) // ["2024-01-01T08:00:00+11:00[Australia/Sydney]", "2024-02-15T15:30:00+11:00[Australia/Sydney]", "2024-03-10T12:00:00+11:00[Australia/Sydney]"]
 * @example sortZoned(["2024-03-10T12:00:00[Australia/Sydney]", "2024-01-01T08:00:00[Australia/Sydney]", "2024-02-15T15:30:00[Australia/Sydney]"], "desc") // ["2024-03-10T12:00:00+11:00[Australia/Sydney]", "2024-02-15T15:30:00+11:00[Australia/Sydney]", "2024-01-01T08:00:00+11:00[Australia/Sydney]"]
 * @example sortZoned(["invalid", "2024-01-01T08:00:00[Australia/Sydney]", "2024-02-15T15:30:00[Australia/Sydney]"]) // ["2024-01-01T08:00:00+11:00[Australia/Sydney]", "2024-02-15T15:30:00+11:00[Australia/Sydney]"]
 * @example sortZoned([]) // []
 */
export function sortZoned(
  zonedDateTimes: string[],
  order: "asc" | "desc" = "asc",
): string[] {
  try {
    if (!Array.isArray(zonedDateTimes) || !zonedDateTimes.length) return [];

    const comparables = zonedDateTimesOf(zonedDateTimes);
    if (!comparables.length) return [];

    try {
      comparables.sort(Temporal.ZonedDateTime.compare);

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
