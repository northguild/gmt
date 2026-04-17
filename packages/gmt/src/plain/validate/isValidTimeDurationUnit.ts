import type { TimeDurationUnit } from "../../types";

/**
 * Return true when `unit` is a valid TimeDurationUnit.
 *
 * - Valid units are: "hours", "minutes", "seconds", "milliseconds", "microseconds", "nanoseconds".
 * - Uses type assertion to narrow the type.
 *
 * @param unit string candidate
 * @returns boolean indicating whether the unit is valid
 *
 * @example isValidTimeDurationUnit("hours") // true
 * @example isValidTimeDurationUnit("minutes") // true
 * @example isValidTimeDurationUnit("seconds") // true
 * @example isValidTimeDurationUnit("invalid") // false
 */
export const isValidTimeDurationUnit = (
  unit: string,
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
