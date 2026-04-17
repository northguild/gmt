import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../validate/isValidUtc";

/**
 * Return the latest (maximum) of the given UTC datetime values.
 *
 * - Filters invalid values before finding maximum.
 * - Returns null if array is empty or has no valid values.
 *
 * @param utcDateTimes Array of ISO datetime strings (e.g. "2024-03-10T12:00:00Z")
 * @returns The latest UTC datetime string, or null on invalid input
 *
 * @example maxUtc(["2024-03-10T12:00:00Z", "2024-03-15T12:00:00Z", "2024-03-12T12:00:00Z"]) // "2024-03-15T12:00:00Z"
 * @example maxUtc(["invalid", "2024-03-15T12:00:00Z"]) // "2024-03-15T12:00:00Z"
 * @example maxUtc(["invalid", "also invalid"]) // null
 * @example maxUtc([]) // null
 */
export function maxUtc(utcDateTimes: string[]): string | null {
  if (!utcDateTimes.length) return null;

  const valid = utcDateTimes.filter(isValidUtc);
  if (!valid.length) return null;

  try {
    const max = valid.reduce((currentMax, candidateStr) => {
      const candidate = Temporal.Instant.from(candidateStr);
      return Temporal.Instant.compare(candidate, currentMax) > 0
        ? candidate
        : currentMax;
    }, Temporal.Instant.from(valid[0]));

    return max.toString();
  } catch {
    return null;
  }
}
