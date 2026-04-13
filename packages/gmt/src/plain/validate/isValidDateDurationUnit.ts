import type { DateDurationUnit } from "../../types";

/**
 * Return true when `unit` is a valid DateDurationUnit.
 *
 * @param unit string candidate
 * @example isValidDateDurationUnit("days") // true
 * @example isValidDateDurationUnit("months") // true
 * @example isValidDateDurationUnit("years") // true
 * @example isValidDateDurationUnit("invalid") // false
 * @returns boolean indicating whether the unit is valid
 */
export const isValidDateDurationUnit = (
  unit: string,
): unit is DateDurationUnit => {
  return (
    unit === "years" || unit === "months" || unit === "weeks" || unit === "days"
  );
};
