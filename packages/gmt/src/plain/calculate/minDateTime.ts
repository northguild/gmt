import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate";

/**
 * Return the earliest (minimum) of the given PlainDateTime values.
 *
 * - Returns null if the array is empty or contains no valid datetimes.
 * - Validation is performed on each item in the array.
 *
 * @param dateTimes Array of ISO PlainDateTime strings (e.g. "2024-03-10T12:00:00")
 * @returns The earliest datetime string, or null on invalid input
 *
 * @example minDateTime(["2024-03-10T12:00:00", "2024-03-15T12:00:00", "2024-03-12T12:00:00"]) // "2024-03-10T12:00:00"
 * @example minDateTime([]) // null
 */
export function minDateTime(dateTimes: string[]): string | null {
  if (!dateTimes.length) return null;

  const valid = dateTimes.filter(isValidDateTime);
  if (!valid.length) return null;

  try {
    const min = valid.reduce((currentMin, candidateStr) => {
      const candidate = Temporal.PlainDateTime.from(candidateStr);
      return Temporal.PlainDateTime.compare(candidate, currentMin) < 0
        ? candidate
        : currentMin;
    }, Temporal.PlainDateTime.from(valid[0]));

    return min.toString();
  } catch {
    return null;
  }
}
