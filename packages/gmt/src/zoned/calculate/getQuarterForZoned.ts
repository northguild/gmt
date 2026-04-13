import { Temporal } from "@js-temporal/polyfill";

import { isValidZonedDateTime } from "../validate";

/**
 * Return the quarter of the year (1-4) for a given zoned ISO datetime.
 *
 * - Validates input using isValidZonedDateTime.
 * - Computes quarter from month: Q1 = months 1-3, Q2 = months 4-6, Q3 = months 7-9, Q4 = months 10-12.
 * - Returns null for invalid inputs.
 *
 * @param value ISO ZonedDateTime string
 * @returns number (1-4) or null for invalid input
 */
export function getQuarterForZoned(value: string): number | null {
  if (!isValidZonedDateTime(value)) {
    return null;
  }

  try {
    const zdt = Temporal.ZonedDateTime.from(value);
    return Math.floor((zdt.month - 1) / 3) + 1;
  } catch {
    return null;
  }
}
