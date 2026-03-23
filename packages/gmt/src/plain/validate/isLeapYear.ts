import { Temporal } from "@js-temporal/polyfill";

/**
 * Return true when the given PlainDate falls in a leap year.
 *
 * - Uses Temporal.PlainDate.from to validate and compute the leap year flag.
 * - Returns false for invalid input.
 *
 * @param value ISO PlainDate string
 * @returns boolean indicating whether the date is in a leap year
 */
export function isLeapYear(value: string): boolean {
  try {
    const date = Temporal.PlainDate.from(value);
    return date.inLeapYear;
  } catch {
    return false;
  }
}
