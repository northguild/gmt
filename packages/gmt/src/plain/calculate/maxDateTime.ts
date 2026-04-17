import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate";

/**
 * Return the latest (maximum) of the given PlainDateTime values.
 *
 * - Returns null if the array is empty or contains no valid datetimes.
 * - Validation is performed on each item in the array.
 *
 * @param dateTimes Array of ISO PlainDateTime strings (e.g. "2024-03-10T12:00:00")
 * @returns The latest datetime string, or null on invalid input
 *
 * @example maxDateTime(["2024-03-10T12:00:00", "2024-03-15T12:00:00", "2024-03-12T12:00:00"]) // "2024-03-15T12:00:00"
 * @example maxDateTime([]) // null
 */
export function maxDateTime(dateTimes: string[]): string | null {
  if (!dateTimes.length) return null;

  const valid = dateTimes.filter(isValidDateTime);
  if (!valid.length) return null;

  try {
    const max = valid.reduce((currentMax, candidateStr) => {
      const candidate = Temporal.PlainDateTime.from(candidateStr);
      return Temporal.PlainDateTime.compare(candidate, currentMax) > 0
        ? candidate
        : currentMax;
    }, Temporal.PlainDateTime.from(valid[0]));

    return max.toString();
  } catch {
    return null;
  }
}
