import type { DateTimeUnit } from "../../types";

/**
 * Return true when `unit` is a valid DateTimeUnit.
 *
 * - Valid units are: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Accepts any input type and returns false for non-string values.
 * - Uses type assertion to narrow the type.
 *
 * @param unit candidate value of any type
 * @returns boolean indicating validity
 *
 * @example isValidDateTimeUnit("year") // true
 * @example isValidDateTimeUnit("month") // true
 * @example isValidDateTimeUnit("weeks") // false
 * @example isValidDateTimeUnit("invalid") // false
 * @example isValidDateTimeUnit(123) // false
 * @example isValidDateTimeUnit(null) // false
 */

export function isValidDateTimeUnit(unit: unknown): unit is DateTimeUnit {
  if (typeof unit !== "string") {
    return false;
  }

  return (
    unit === "year" ||
    unit === "month" ||
    unit === "week" ||
    unit === "day" ||
    unit === "hour" ||
    unit === "minute" ||
    unit === "second" ||
    unit === "millisecond" ||
    unit === "microsecond" ||
    unit === "nanosecond"
  );
}
