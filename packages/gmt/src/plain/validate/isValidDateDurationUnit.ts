import type { DateDurationUnit } from "../../types";

/**
 * Return true when `unit` is a valid DateDurationUnit.
 *
 * - Valid units are: "years", "months", "weeks", "days".
 * - Uses type assertion to narrow the type.
 *
 * @param unit string candidate
 * @returns boolean indicating whether the unit is valid
 *
 * @example isValidDateDurationUnit("days") // true
 * @example isValidDateDurationUnit("months") // true
 * @example isValidDateDurationUnit("years") // true
 * @example isValidDateDurationUnit("invalid") // false
 */
export const isValidDateDurationUnit = (
  unit: string,
): unit is DateDurationUnit => {
  return (
    unit === "years" || unit === "months" || unit === "weeks" || unit === "days"
  );
};
