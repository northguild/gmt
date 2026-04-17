import type { DateTimeDurationUnit } from "../../types";

/**
 * Return the largest DateTimeDurationUnit from the provided array.
 *
 * - Returns the largest unit based on Temporal's unit order: years > months > weeks > days > hours > minutes > seconds > milliseconds > microseconds > nanoseconds.
 * - Defaults to "seconds" if no valid unit is found in the array.
 *
 * @param units array of DateTimeDurationUnit to evaluate
 * @returns the largest DateTimeDurationUnit found, or "seconds" if none are valid
 *
 * @example getLargestDateTimeDurationUnit(["hours", "minutes", "seconds"]) // "hours"
 * @example getLargestDateTimeDurationUnit(["minutes", "seconds"]) // "minutes"
 * @example getLargestDateTimeDurationUnit(["seconds"]) // "seconds"
 * @example getLargestDateTimeDurationUnit([]) // "seconds"
 */
export function getLargestDateTimeDurationUnit(
  units: DateTimeDurationUnit[],
): DateTimeDurationUnit {
  const order: DateTimeDurationUnit[] = [
    "years",
    "months",
    "weeks",
    "days",
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
