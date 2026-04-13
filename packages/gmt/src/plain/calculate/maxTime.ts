import { Temporal } from "@js-temporal/polyfill";
import { isValidTime } from "../validate";

/**
 * Return the latest (maximum) of the given PlainTime values.
 *
 * - Returns null if the array is empty or contains no valid times.
 * - Validation is performed on each item in the array.
 *
 * @param times Array of ISO PlainTime strings (e.g. "14:30:00")
 * @example maxTime(["14:30:00", "09:00:00", "20:45:00"]) // "20:45:00"
 * @example maxTime(["invalid", "09:00:00", "20:45:00"]) // "20:45:00"
 * @example maxTime(["invalid", "also invalid"]) // null
 * @example maxTime([]) // null
 * @returns The latest time string, or null on invalid input
 */
export function maxTime(times: string[]): string | null {
  if (!times.length) return null;

  const valid = times.filter(isValidTime);
  if (!valid.length) return null;

  const comparables = valid.map((t) => Temporal.PlainTime.from(t));
  comparables.sort(Temporal.PlainTime.compare);

  return comparables[comparables.length - 1].toString();
}
