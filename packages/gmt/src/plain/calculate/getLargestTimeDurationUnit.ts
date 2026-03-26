import type { TimeDurationUnit } from "../../types";

/**
 * Return the largest TimeDurationUnit from the provided array, based on the order of units in Temporal.
 * The order of units from largest to smallest is: hours, minutes, seconds, milliseconds, microseconds, nanoseconds.
 * If no valid unit is found, defaults to "seconds" (though this case should be prevented by validation).
 *
 * @param units array of TimeDurationUnits to evaluate
 * @example getLargestTimeDurationUnit(["minutes", "seconds"]) => "minutes"
 * @returns the largest TimeDurationUnit found in the array, or "seconds" if none are valid
 */
export function getLargestTimeDurationUnit(
  units: TimeDurationUnit[],
): TimeDurationUnit {
  const order: TimeDurationUnit[] = [
    "hours",
    "minutes",
    "seconds",
    "milliseconds",
    "microseconds",
    "nanoseconds",
  ];
  for (const unit of order) {
    if (units.includes(unit)) {
      return unit;
    }
  }
  // Default to seconds if no valid unit found, though this case should be prevented by validation
  return "seconds";
}
