import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../validate/isValidUtc";

/**
 * Return the earliest (minimum) of the given UTC datetime values.
 *
 * - Returns null if the array is empty or contains no valid UTC datetimes.
 * - Validation is performed on each item in the array.
 *
 * @param utcDateTimes Array of ISO datetime strings (e.g. "2024-03-10T12:00:00Z")
 * @returns The earliest UTC datetime string, or null on invalid input
 */
export function minUtc(utcDateTimes: string[]): string | null {
  if (!utcDateTimes.length) return null;

  const valid = utcDateTimes.filter(isValidUtc);
  if (!valid.length) return null;

  const comparables = valid.map((d) => Temporal.Instant.from(d));
  comparables.sort(Temporal.Instant.compare);

  return comparables[0].toString();
}
