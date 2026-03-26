import type { TimeDurationUnit } from "../../types";

/**
 * Return true when `unit` is a valid TimeDurationUnit.
 *
 * @param unit string candidate
 * @returns boolean indicating whether the unit is valid
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
