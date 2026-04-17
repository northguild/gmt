import type { DateTimeDurationUnit } from "../../types";

/**
 * Return true when `unit` is a valid DateTimeDurationUnit.
 *
 * - Valid units are: "years", "months", "weeks", "days", "hours", "minutes", "seconds", "milliseconds", "microseconds", "nanoseconds".
 * - Uses type assertion to narrow the type.
 *
 * @param unit candidate string
 * @returns boolean indicating validity
 *
 * @example isValidDateTimeDurationUnit("days") // true
 * @example isValidDateTimeDurationUnit("hours") // true
 * @example isValidDateTimeDurationUnit("minutes") // true
 * @example isValidDateTimeDurationUnit("invalid") // false
 */
export const isValidDateTimeDurationUnit = (
  unit: string,
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
