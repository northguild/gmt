import type { DateDurationUnit } from "../../types";

/**
 * Return true when `unit` is a valid DateDurationUnit.
 *
 * @param unit string candidate
 * @returns boolean indicating whether the unit is valid
 */
export const isValidDateDurationUnit = (
  unit: string,
): unit is DateDurationUnit => {
  return (
    unit === "years" || unit === "months" || unit === "weeks" || unit === "days"
  );
};
