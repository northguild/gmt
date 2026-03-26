import type { DateDurationUnit } from "../../types";

/**
 * Given an array of DateDurationUnits, return the largest unit present. This is needed to determine the largestUnit option for Temporal's until() method when calculating differences between PlainDate values.
 * The order of units from largest to smallest is: years, months, weeks, days.
 * If no valid unit is found, defaults to "days" (though this case should be prevented by validation).
 *
 * @param units array of DateDurationUnits to evaluate
 * @example getLargestDateDurationUnit(["months", "days"]) => "months"
 * @returns the largest DateDurationUnit found in the array, or "days" if none are valid
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
