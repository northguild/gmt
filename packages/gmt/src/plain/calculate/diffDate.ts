import { Temporal } from "@js-temporal/polyfill";
import { isValidDate, isValidDateUnit } from "../validate";

/**
 * Return the difference between two PlainDate values using the provided
 * `unit` (day|week|month|year).
 *
 * - Returns `null` for invalid inputs or units.
 * - Uses Temporal.PlainDate.until and extracts the requested unit from the
 *   resulting Duration.
 *
 * @param date1 ISO PlainDate string for the start
 * @param date2 ISO PlainDate string for the end
 * @param unit Temporal.DateUnit (day|week|month|year)
 * @returns numeric difference in the requested unit, or null on invalid input
 */
export function diffDate(
  date1: string,
  date2: string,
  unit: Temporal.DateUnit,
): number | null {
  const validDates = isValidDate(date1) && isValidDate(date2);
  const validUnit = isValidDateUnit(unit);

  if (!validDates || !validUnit) {
    return null;
  }

  const d1 = Temporal.PlainDate.from(date1);
  const d2 = Temporal.PlainDate.from(date2);

  const duration = d1.until(d2, { largestUnit: unit });

  // Extract the specific unit
  switch (unit) {
    case "day":
      return duration.days;
    case "week":
      return duration.weeks;
    case "month":
      return duration.months;
    case "year":
      return duration.years;
    default:
      return null; // Invalid unit
  }
}
