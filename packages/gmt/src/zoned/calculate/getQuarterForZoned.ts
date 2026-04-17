import { Temporal } from "@js-temporal/polyfill";

import { isValidZonedDateTime } from "../validate";

/**
 * Return the quarter of the year (1-4) for a given zoned ISO datetime.
 *
 * - Q1 = months 1-3, Q2 = months 4-6, Q3 = months 7-9, Q4 = months 10-12.
 * - Validation is performed on the input.
 *
 * @param value ISO ZonedDateTime string
 * @returns number (1-4) or null on invalid input
 *
 * @example getQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]") // 1
 * @example getQuarterForZoned("2024-05-10T10:00:00+00:00[UTC]") // 2
 * @example getQuarterForZoned("2024-11-20T08:00:00+00:00[UTC]") // 4
 * @example getQuarterForZoned("invalid") // null
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
