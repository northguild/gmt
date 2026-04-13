import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate";

/**
 * Return the earliest (minimum) of the given PlainDateTime values.
 *
 * - Returns null if the array is empty or contains no valid datetimes.
 * - Validation is performed on each item in the array.
 *
 * @param dateTimes Array of ISO PlainDateTime strings (e.g. "2024-03-10T12:00:00")
 * @example minDateTime(["2024-03-10T12:00:00", "2024-03-15T12:00:00", "2024-03-12T12:00:00"]) // "2024-03-10T12:00:00"
 * @example minDateTime(["invalid", "2024-03-15T12:00:00"]) // "2024-03-15T12:00:00"
 * @example minDateTime(["invalid", "also invalid"]) // null
 * @example minDateTime([]) // null
 * @returns The earliest datetime string, or null on invalid input
 */
export function minDateTime(dateTimes: string[]): string | null {
  if (!dateTimes.length) return null;

  const valid = dateTimes.filter(isValidDateTime);
  if (!valid.length) return null;

  const comparables = valid.map((d) => Temporal.PlainDateTime.from(d));
  comparables.sort(Temporal.PlainDateTime.compare);

  return comparables[0].toString();
}
