import type { TimeDurationUnit } from "../../types";

/**
 * Return the largest TimeDurationUnit from the provided array.
 *
 * - Returns the largest unit based on Temporal's unit order: hours > minutes > seconds > milliseconds > microseconds > nanoseconds.
 * - Defaults to "seconds" if no valid unit is found in the array.
 *
 * @param units array of TimeDurationUnits to evaluate
 * @returns the largest TimeDurationUnit found in the array, or "seconds" if none are valid
 *
 * @example getLargestTimeDurationUnit(["minutes", "seconds"]) // "minutes"
 * @example getLargestTimeDurationUnit(["seconds", "milliseconds"]) // "seconds"
 * @example getLargestTimeDurationUnit(["milliseconds", "microseconds"]) // "milliseconds"
 * @example getLargestTimeDurationUnit([]) // "seconds"
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
