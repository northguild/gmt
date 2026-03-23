import type { Temporal } from "@js-temporal/polyfill";

/**
 * Return true when `unit` is a valid Temporal.TimeUnit.
 *
 * @param unit string candidate
 * @returns boolean indicating whether the unit is valid
 */
export const isValidTimeUnit = (unit: string): unit is Temporal.TimeUnit => {
  return (
    unit === "hour" ||
    unit === "minute" ||
    unit === "second" ||
    unit === "millisecond" ||
    unit === "microsecond" ||
    unit === "nanosecond"
  );
};
