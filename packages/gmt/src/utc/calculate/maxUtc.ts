import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../validate/isValidUtc";

/**
 * Return the latest (maximum) of the given UTC datetime values.
 *
 * - Returns null if the array is empty or contains no valid UTC datetimes.
 * - Validation is performed on each item in the array.
 *
 * @param utcDateTimes Array of ISO datetime strings (e.g. "2024-03-10T12:00:00Z")
 * @example maxUtc(["2024-03-10T12:00:00Z", "2024-03-15T12:00:00Z", "2024-03-12T12:00:00Z"]) // "2024-03-15T12:00:00Z"
 * @example maxUtc(["invalid", "2024-03-15T12:00:00Z"]) // "2024-03-15T12:00:00Z"
 * @example maxUtc(["invalid", "also invalid"]) // null
 * @example maxUtc([]) // null
 * @returns The latest UTC datetime string, or null on invalid input
 */
export function maxUtc(utcDateTimes: string[]): string | null {
  if (!utcDateTimes.length) return null;

  const valid = utcDateTimes.filter(isValidUtc);
  if (!valid.length) return null;

  const comparables = valid.map((d) => Temporal.Instant.from(d));
  comparables.sort(Temporal.Instant.compare);

  return comparables[comparables.length - 1].toString();
}
