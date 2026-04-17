import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../validate/isValidUtc";

/**
 * Return the earliest (minimum) of the given UTC datetime values.
 *
 * - Filters invalid values before finding minimum using Temporal.Instant.compare.
 * - Returns null if array is empty or has no valid values.
 *
 * @param utcDateTimes Array of ISO datetime strings (e.g. "2024-03-10T12:00:00Z")
 * @returns The earliest UTC datetime string, or null on invalid input
 *
 * @example minUtc(["2024-03-10T12:00:00Z", "2024-03-15T12:00:00Z", "2024-03-12T12:00:00Z"]) // "2024-03-10T12:00:00Z"
 * @example minUtc(["invalid", "2024-03-15T12:00:00Z"]) // "2024-03-15T12:00:00Z"
 * @example minUtc(["invalid", "also invalid"]) // null
 * @example minUtc([]) // null
 */
export function minUtc(utcDateTimes: string[]): string | null {
  if (!utcDateTimes.length) return null;

  const valid = utcDateTimes.filter(isValidUtc);
  if (!valid.length) return null;

  try {
    const min = valid.reduce((currentMin, candidateStr) => {
      const candidate = Temporal.Instant.from(candidateStr);
      return Temporal.Instant.compare(candidate, currentMin) < 0
        ? candidate
        : currentMin;
    }, Temporal.Instant.from(valid[0]));

    return min.toString();
  } catch {
    return null;
  }
}
