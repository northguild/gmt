import type {
  DateDurationUnit,
  DateTimeDurationUnit,
  TimeDurationUnit,
} from "../types";
import {
  DATE_DURATION_UNITS,
  isDateTimeDurationUnitName,
  TIME_DURATION_UNITS,
} from "./unitNames";

/**
 * Normalize a duration unit string to its plural form.
 *
 * - Accepts singular ("day"), plural ("days"), and already-plural forms.
 * - Returns the original string if it is not a recognized DateTimeDurationUnit.
 * - Returns a non-string input unchanged, so callers can pass raw option values and let their own
 *   validator reject them.
 *
 * @param unit raw unit value from caller input
 * @returns normalized plural unit string, or the original if not recognized
 */
export function resolveDurationUnit(unit: string): string;
export function resolveDurationUnit(unit: unknown): unknown;
export function resolveDurationUnit(unit: unknown): unknown {
  if (typeof unit !== "string" || isDateTimeDurationUnitName(unit)) {
    return unit;
  }

  if (unit.endsWith("s")) {
    return unit;
  }

  const plural = `${unit}s`;
  if (isDateTimeDurationUnitName(plural)) {
    return plural;
  }

  return unit;
}

// The largest unit of `order` named in `units`, each name first resolved to its plural; `""` for
// an empty list, a non-array, or any name outside `order`.
function largestOf<T extends string>(
  units: unknown,
  order: readonly T[],
): T | "" {
  try {
    if (!Array.isArray(units) || units.length === 0) return "";

    const plurals: unknown[] = units.map((unit) => resolveDurationUnit(unit));
    const known = plurals.every(
      (unit) =>
        typeof unit === "string" && (order as readonly string[]).includes(unit),
    );

    return known ? (order.find((unit) => plurals.includes(unit)) ?? "") : "";
  } catch {
    return "";
  }
}

/**
 * The largest date duration unit in a list, after each name is resolved to its plural.
 *
 * @param units the unit names, singular or plural
 * @returns the largest unit in plural form, or `""` for an empty list, a non-array or any name that is not a date unit
 *
 * @example largestDateDurationUnit(["days", "month"]) // "months"
 * @example largestDateDurationUnit([]) // ""
 */
export function largestDateDurationUnit(units: unknown): DateDurationUnit | "" {
  return largestOf(units, DATE_DURATION_UNITS);
}

/**
 * The largest date-time duration unit in a list, after each name is resolved to its plural.
 *
 * @param units the unit names, singular or plural
 * @returns the largest unit in plural form, or `""` for an empty list, a non-array or any name that is not a date-time unit
 *
 * @example largestDateTimeDurationUnit(["minutes", "day"]) // "days"
 * @example largestDateTimeDurationUnit([]) // ""
 */
export function largestDateTimeDurationUnit(
  units: unknown,
): DateTimeDurationUnit | "" {
  return largestOf(units, [...DATE_DURATION_UNITS, ...TIME_DURATION_UNITS]);
}

/**
 * The largest time duration unit in a list, after each name is resolved to its plural.
 *
 * @param units the unit names, singular or plural
 * @returns the largest unit in plural form, or `""` for an empty list, a non-array or any name that is not a time unit
 *
 * @example largestTimeDurationUnit(["seconds", "hour"]) // "hours"
 * @example largestTimeDurationUnit([]) // ""
 */
export function largestTimeDurationUnit(units: unknown): TimeDurationUnit | "" {
  return largestOf(units, TIME_DURATION_UNITS);
}
