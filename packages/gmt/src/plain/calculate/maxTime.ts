import { Temporal } from "@js-temporal/polyfill";
import { isValidTime } from "../validate";

/**
 * Return the latest (maximum) of the given PlainTime values.
 *
 * - Returns null if the array is empty or contains no valid times.
 * - Validation is performed on each item in the array.
 *
 * @param times Array of ISO PlainTime strings (e.g. "14:30:00")
 * @returns The latest time string, or null on invalid input
 *
 * @example maxTime(["14:30:00", "09:00:00", "20:45:00"]) // "20:45:00"
 * @example maxTime([]) // null
 */
export function maxTime(times: string[]): string | null {
  if (!times.length) return null;

  const valid = times.filter(isValidTime);
  if (!valid.length) return null;

  try {
    const max = valid.reduce((currentMax, candidateStr) => {
      const candidate = Temporal.PlainTime.from(candidateStr);
      return Temporal.PlainTime.compare(candidate, currentMax) > 0
        ? candidate
        : currentMax;
    }, Temporal.PlainTime.from(valid[0]));

    return max.toString();
  } catch {
    return null;
  }
}
