import type { DateTimeDurationUnit } from "../../types";

/**
 * Return true when `unit` is a valid DateTimeDurationUnit.
 *
 * @param unit candidate string
 * @returns boolean indicating validity
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
