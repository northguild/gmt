import { Temporal } from "@js-temporal/polyfill";

import { isValidIsoDateLike } from "../validate";

/**
 * Compare two ISO date-like strings for equality, ignoring time components.
 *
 * - Accepts both PlainDate and PlainDateTime strings.
 * - Extracts date components only for comparison.
 * - Returns false if either input is invalid.
 *
 * @param value1 ISO date-like string
 * @param value2 ISO date-like string
 * @returns true if the dates are equal, false otherwise
 *
 * @example areDatesEqual("2024-02-29", "2024-02-29T12:34:56") // true
 * @example areDatesEqual("2024-02-29", "2024-03-01") // false
 * @example areDatesEqual("invalid", "2024-02-29") // false
 * @example areDatesEqual("2024-02-29", "invalid") // false
 */
export function areDatesEqual(value1: string, value2: string): boolean {
  if (!isValidIsoDateLike(value1) || !isValidIsoDateLike(value2)) {
    return false;
  }

  try {
    const date1 = Temporal.PlainDate.from(value1);
    const date2 = Temporal.PlainDate.from(value2);

    return (
      date1.year === date2.year &&
      date1.month === date2.month &&
      date1.day === date2.day
    );
  } catch {
    return false;
  }
}
