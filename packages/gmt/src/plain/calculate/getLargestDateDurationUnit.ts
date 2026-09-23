// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import type { Temporal } from "@js-temporal/polyfill";
import { resolveDurationUnit } from "../../internal/resolveDurationUnit";
import type { DateDurationUnit } from "../../types";
import { isValidDateDurationUnit } from "../validate/isValidDateDurationUnit";

const ORDER: readonly DateDurationUnit[] = ["years", "months", "weeks", "days"];

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
  try {
    if (!Array.isArray(units) || units.length === 0) return "";

    const plurals: unknown[] = units.map((unit) => resolveDurationUnit(unit));
    if (
      !plurals.every(
        (unit): unit is DateDurationUnit =>
          typeof unit === "string" && isValidDateDurationUnit(unit),
      )
    ) {
      return "";
    }

    return ORDER.find((unit) => plurals.includes(unit)) ?? "";
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
