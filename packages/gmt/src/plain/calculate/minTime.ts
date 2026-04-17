import { Temporal } from "@js-temporal/polyfill";
import { isValidTime } from "../validate";

/**
 * Return the earliest (minimum) of the given PlainTime values.
 *
 * - Returns null if the array is empty or contains no valid times.
 * - Validation is performed on each item in the array.
 *
 * @param times Array of ISO PlainTime strings (e.g. "14:30:00")
 * @returns The earliest time string, or null on invalid input
 *
 * @example minTime(["14:30:00", "09:00:00", "20:45:00"]) // "09:00:00"
 * @example minTime([]) // null
 */
export function minTime(times: string[]): string | null {
  if (!times.length) return null;

  const valid = times.filter(isValidTime);
  if (!valid.length) return null;

  try {
    const min = valid.reduce((currentMin, candidateStr) => {
      const candidate = Temporal.PlainTime.from(candidateStr);
      return Temporal.PlainTime.compare(candidate, currentMin) < 0
        ? candidate
        : currentMin;
    }, Temporal.PlainTime.from(valid[0]));

    return min.toString();
  } catch {
    return null;
  }
}
