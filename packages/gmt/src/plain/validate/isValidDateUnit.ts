import type { Temporal } from "@js-temporal/polyfill";

/**
 * Return true when `unit` is a valid Temporal.DateUnit.
 *
 * @param unit string candidate
 * @returns boolean indicating whether the unit is valid
 */
export const isValidDateUnit = (unit: string): unit is Temporal.DateUnit => {
  return (
    unit === "year" || unit === "month" || unit === "week" || unit === "day"
  );
};
