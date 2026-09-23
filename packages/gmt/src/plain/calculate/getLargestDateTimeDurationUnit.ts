// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import type { Temporal } from "@js-temporal/polyfill";
import { resolveDurationUnit } from "../../internal/resolveDurationUnit";
import type { DateTimeDurationUnit } from "../../types";
import { isValidDateTimeDurationUnit } from "../validate/isValidDateTimeDurationUnit";

const ORDER: readonly DateTimeDurationUnit[] = [
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

/**
 * Return the largest DateTimeDurationUnit from the provided array.
 *
 * - Returns the largest unit based on Temporal's unit order: years > months > weeks > days > hours > minutes > seconds > milliseconds > microseconds > nanoseconds.
 * - Each unit may be singular or plural (`"day"` or `"days"`), as Temporal accepts; the result is
 *   the plural name.
 * - Returns "" when `units` is not an array, is empty, or holds anything that is not a unit of
 *   this family.
 * - **Compatibility:** before 1.16.0 an empty or invalid `units` returned a default unit
 *   (`"seconds"`).
 *
 * @param units array of DateTimeDurationUnits (singular or plural names) to evaluate
 * @returns the largest DateTimeDurationUnit found in the array, or "" on invalid input
 *
 * @example getLargestDateTimeDurationUnit(["hours", "minutes", "seconds"]) // "hours"
 * @example getLargestDateTimeDurationUnit(["minutes", "seconds"]) // "minutes"
 * @example getLargestDateTimeDurationUnit(["hour", "day"]) // "days" (singular names count as their plural)
 * @example getLargestDateTimeDurationUnit([]) // "" (no unit to choose from)
 * @example getLargestDateTimeDurationUnit(["seconds", "fortnights"]) // "" (an invalid unit)
 */
export function getLargestDateTimeDurationUnit(
  units: Array<DateTimeDurationUnit | Temporal.DateTimeUnit>,
): DateTimeDurationUnit | "" {
  try {
    if (!Array.isArray(units) || units.length === 0) return "";

    const plurals: unknown[] = units.map((unit) => resolveDurationUnit(unit));
    if (
      !plurals.every(
        (unit): unit is DateTimeDurationUnit =>
          typeof unit === "string" && isValidDateTimeDurationUnit(unit),
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
