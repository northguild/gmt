import type { TimeDurationUnit } from "../../types";

/**
 * Return true when `unit` is a valid TimeDurationUnit.
 *
 * - Valid units are: "hours", "minutes", "seconds", "milliseconds", "microseconds", "nanoseconds".
 * - A value that is not a string, a `String` object included, returns `false`. A `true` result
 *   narrows the value to the unit type.
 *
 * @param unit any value; a string is checked against the time duration units
 * @returns boolean indicating whether the unit is valid
 *
 * @example isValidTimeDurationUnit("hours") // true
 * @example isValidTimeDurationUnit("minutes") // true
 * @example isValidTimeDurationUnit("seconds") // true
 * @example isValidTimeDurationUnit("invalid") // false
 * @example isValidTimeDurationUnit(null) // false
 */
export const isValidTimeDurationUnit = (
  unit: unknown,
): unit is TimeDurationUnit => {
  return (
    unit === "hours" ||
    unit === "minutes" ||
    unit === "seconds" ||
    unit === "milliseconds" ||
    unit === "microseconds" ||
    unit === "nanoseconds"
  );
};
