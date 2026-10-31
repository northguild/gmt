import type { DateTimeDurationUnit } from "../../types";

/**
 * Return true when `unit` is a valid DateTimeDurationUnit.
 *
 * - Valid units are: "years", "months", "weeks", "days", "hours", "minutes", "seconds", "milliseconds", "microseconds", "nanoseconds".
 * - A value that is not a string, a `String` object included, returns `false`. A `true` result
 *   narrows the value to the unit type.
 *
 * @param unit any value; a string is checked against the date-time duration units
 * @returns boolean indicating validity
 *
 * @example isValidDateTimeDurationUnit("days") // true
 * @example isValidDateTimeDurationUnit("hours") // true
 * @example isValidDateTimeDurationUnit("minutes") // true
 * @example isValidDateTimeDurationUnit("invalid") // false
 * @example isValidDateTimeDurationUnit(null) // false
 */
export const isValidDateTimeDurationUnit = (
  unit: unknown,
): unit is DateTimeDurationUnit => {
  return (
    unit === "years" ||
    unit === "months" ||
    unit === "weeks" ||
    unit === "days" ||
    unit === "hours" ||
    unit === "minutes" ||
    unit === "seconds" ||
    unit === "milliseconds" ||
    unit === "microseconds" ||
    unit === "nanoseconds"
  );
};
