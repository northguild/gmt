// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import type { Temporal } from "../../internal/temporal";
import { largestDateDurationUnit } from "../../internal/resolveDurationUnit";
import type { DateDurationUnit } from "../../types";

/**
 * Return the largest DateDurationUnit from the provided array.
 *
 * - Returns the largest unit based on Temporal's unit order: years > months > weeks > days.
 * - Each unit may be singular or plural (`"day"` or `"days"`), as Temporal accepts; the result is
 *   the plural name.
 * - Returns "" when `units` is not an array, is empty, or holds anything that is not a unit of
 *   this family.
 * - **Compatibility:** before 1.16.0 an empty or invalid `units` returned a default unit
 *   (`"days"`).
 *
 * @param units array of DateDurationUnits (singular or plural names) to evaluate
 * @returns the largest DateDurationUnit found in the array, or "" on invalid input
 *
 * @example getLargestDateDurationUnit(["months", "days"]) // "months"
 * @example getLargestDateDurationUnit(["weeks", "days"]) // "weeks"
 * @example getLargestDateDurationUnit(["day", "month"]) // "months" (singular names count as their plural)
 * @example getLargestDateDurationUnit(["days"]) // "days"
 * @example getLargestDateDurationUnit([]) // "" (no unit to choose from)
 * @example getLargestDateDurationUnit(["days", "bananas"]) // "" (an invalid unit)
 */
export function getLargestDateDurationUnit(
  units: Array<DateDurationUnit | Temporal.DateUnit>,
): DateDurationUnit | "" {
  return largestDateDurationUnit(units);
}
