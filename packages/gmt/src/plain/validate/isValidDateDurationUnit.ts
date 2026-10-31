import type { DateDurationUnit } from "../../types";

/**
 * Return true when `unit` is a valid DateDurationUnit.
 *
 * - Valid units are: "years", "months", "weeks", "days".
 * - A value that is not a string, a `String` object included, returns `false`. A `true` result
 *   narrows the value to the unit type.
 *
 * @param unit any value; a string is checked against the date duration units
 * @returns boolean indicating whether the unit is valid
 *
 * @example isValidDateDurationUnit("days") // true
 * @example isValidDateDurationUnit("months") // true
 * @example isValidDateDurationUnit("years") // true
 * @example isValidDateDurationUnit("invalid") // false
 * @example isValidDateDurationUnit(null) // false
 */
export const isValidDateDurationUnit = (
  unit: unknown,
): unit is DateDurationUnit => {
  return (
    unit === "years" || unit === "months" || unit === "weeks" || unit === "days"
  );
};
