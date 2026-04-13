import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "../validate";

/**
 * Return the latest (maximum) of the given PlainDate values.
 *
 * - Returns null if the array is empty or contains no valid dates.
 * - Validation is performed on each item in the array.
 *
 * @param dates Array of ISO PlainDate strings (e.g. "2024-03-10")
 * @example maxDate(["2024-03-10", "2024-03-15", "2024-03-12"]) // "2024-03-15"
 * @example maxDate(["invalid", "2024-03-15", "2024-03-12"]) // "2024-03-15"
 * @example maxDate(["invalid", "also invalid"]) // null
 * @example maxDate([]) // null
 * @returns The latest date string, or null on invalid input
 */
export function maxDate(dates: string[]): string | null {
  if (!dates.length) return null;

  const valid = dates.filter(isValidDate);
  if (!valid.length) return null;

  const comparables = valid.map((d) => Temporal.PlainDate.from(d));
  comparables.sort(Temporal.PlainDate.compare);

  return comparables[comparables.length - 1].toString();
}
