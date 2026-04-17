import type { TimeUnit } from "../../types";

/**
 * Return true when `unit` is a valid TimeUnit.
 *
 * - Valid units are: "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Accepts any input type and returns false for non-string values.
 * - Uses type assertion to narrow the type.
 *
 * @param unit candidate value of any type
 * @returns boolean indicating validity
 *
 * @example isValidTimeUnit("hour") // true
 * @example isValidTimeUnit("minute") // true
 * @example isValidTimeUnit("second") // true
 * @example isValidTimeUnit("invalid") // false
 * @example isValidTimeUnit(123) // false
 * @example isValidTimeUnit(null) // false
 */

export function isValidTimeUnit(unit: unknown): unit is TimeUnit {
  if (typeof unit !== "string") {
    return false;
  }

  return (
    unit === "hour" ||
    unit === "minute" ||
    unit === "second" ||
    unit === "millisecond" ||
    unit === "microsecond" ||
    unit === "nanosecond"
  );
}
