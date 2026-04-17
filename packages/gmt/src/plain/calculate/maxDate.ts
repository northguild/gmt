import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "../validate";

/**
 * Return the latest (maximum) of the given PlainDate values.
 *
 * - Returns null if the array is empty or contains no valid dates.
 * - Validation is performed on each item in the array.
 *
 * @param dates Array of ISO PlainDate strings (e.g. "2024-03-10")
 * @returns The latest date string, or null on invalid input
 *
 * @example maxDate(["2024-03-10", "2024-03-15", "2024-03-12"]) // "2024-03-15"
 * @example maxDate([]) // null
 */
export function maxDate(dates: string[]): string | null {
  if (!dates.length) return null;

  const valid = dates.filter(isValidDate);
  if (!valid.length) return null;

  try {
    const max = valid.reduce((currentMax, candidateStr) => {
      const candidate = Temporal.PlainDate.from(candidateStr);
      return Temporal.PlainDate.compare(candidate, currentMax) > 0
        ? candidate
        : currentMax;
    }, Temporal.PlainDate.from(valid[0]));

    return max.toString();
  } catch {
    return null;
  }
}
