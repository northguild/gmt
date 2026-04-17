import type { DateUnit } from "../../types";

/**
 * Return true when `unit` is a valid DateUnit.
 *
 * - Valid units are: "year", "month", "week", "day".
 * - Accepts any input type and returns false for non-string values.
 * - Uses type assertion to narrow the type.
 *
 * @param unit candidate value of any type
 * @returns boolean indicating validity
 *
 * @example isValidDateUnit("year") // true
 * @example isValidDateUnit("month") // true
 * @example isValidDateUnit("week") // true
 * @example isValidDateUnit("day") // true
 * @example isValidDateUnit("hour") // false
 * @example isValidDateUnit("invalid") // false
 * @example isValidDateUnit(123) // false
 * @example isValidDateUnit(null) // false
 */

export function isValidDateUnit(unit: unknown): unit is DateUnit {
  if (typeof unit !== "string") {
    return false;
  }

  return (
    unit === "year" || unit === "month" || unit === "week" || unit === "day"
  );
}
