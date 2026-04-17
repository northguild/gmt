import type { DateDurationUnit } from "../../types";

/**
 * Return the largest DateDurationUnit from the provided array.
 *
 * - Returns the largest unit based on Temporal's unit order: years > months > weeks > days.
 * - Defaults to "days" if no valid unit is found in the array.
 *
 * @param units array of DateDurationUnits to evaluate
 * @returns the largest DateDurationUnit found in the array, or "days" if none are valid
 *
 * @example getLargestDateDurationUnit(["months", "days"]) // "months"
 * @example getLargestDateDurationUnit(["weeks", "days"]) // "weeks"
 * @example getLargestDateDurationUnit(["days"]) // "days"
 * @example getLargestDateDurationUnit([]) // "days"
 */

export function getLargestDateDurationUnit(
  units: DateDurationUnit[],
): DateDurationUnit {
  const order: DateDurationUnit[] = ["years", "months", "weeks", "days"];
  for (const unit of order) {
    if (units.includes(unit)) {
      return unit;
    }
  }
  // Default to days if no valid unit found, though this case should be prevented by validation
  return "days";
}
