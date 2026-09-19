// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import type { Temporal } from "@js-temporal/polyfill";
import { resolveDurationUnit } from "../../internal/resolveDurationUnit";
import type { TimeDurationUnit } from "../../types";
import { isValidTimeDurationUnit } from "../validate/isValidTimeDurationUnit";

const ORDER: readonly TimeDurationUnit[] = [
  "hours",
  "minutes",
  "seconds",
  "milliseconds",
  "microseconds",
  "nanoseconds",
];

/**
 * Return the largest TimeDurationUnit from the provided array.
 *
 * - Returns the largest unit based on Temporal's unit order: hours > minutes > seconds > milliseconds > microseconds > nanoseconds.
 * - Each unit may be singular or plural (`"day"` or `"days"`), as Temporal accepts; the result is
 *   the plural name.
 * - Returns "" when `units` is not an array, is empty, or holds anything that is not a unit of
 *   this family.
 * - **Compatibility:** before 1.16.0 an empty or invalid `units` returned a default unit
 *   (`"seconds"`).
 *
 * @param units array of TimeDurationUnits (singular or plural names) to evaluate
 * @returns the largest TimeDurationUnit found in the array, or "" on invalid input
 *
 * @example getLargestTimeDurationUnit(["minutes", "seconds"]) // "minutes"
 * @example getLargestTimeDurationUnit(["seconds", "milliseconds"]) // "seconds"
 * @example getLargestTimeDurationUnit(["second", "minute"]) // "minutes" (singular names count as their plural)
 * @example getLargestTimeDurationUnit([]) // "" (no unit to choose from)
 * @example getLargestTimeDurationUnit(["seconds", "fortnights"]) // "" (an invalid unit)
 */
export function getLargestTimeDurationUnit(
  units: Array<TimeDurationUnit | Temporal.TimeUnit>,
): TimeDurationUnit | "" {
  if (!Array.isArray(units) || units.length === 0) return "";

  const plurals: unknown[] = units.map((unit) => resolveDurationUnit(unit));
  if (
    !plurals.every(
      (unit): unit is TimeDurationUnit =>
        typeof unit === "string" && isValidTimeDurationUnit(unit),
    )
  ) {
    return "";
  }

  return ORDER.find((unit) => plurals.includes(unit)) ?? "";
}
