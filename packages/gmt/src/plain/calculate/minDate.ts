import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "../validate";

/**
 * Return the earliest (minimum) of the given PlainDate values.
 *
 * - Returns null if the array is empty or contains no valid dates.
 * - Validation is performed on each item in the array.
 *
 * @param dates Array of ISO PlainDate strings (e.g. "2024-03-10")
 * @returns The earliest date string, or null on invalid input
 *
 * @example minDate(["2024-03-10", "2024-03-15", "2024-03-12"]) // "2024-03-10"
 * @example minDate([]) // null
 */
export function minDate(dates: string[]): string | null {
  if (!dates.length) return null;

  const valid = dates.filter(isValidDate);
  if (!valid.length) return null;

  try {
    const min = valid.reduce((currentMin, candidateStr) => {
      const candidate = Temporal.PlainDate.from(candidateStr);
      return Temporal.PlainDate.compare(candidate, currentMin) < 0
        ? candidate
        : currentMin;
    }, Temporal.PlainDate.from(valid[0]));

    return min.toString();
  } catch {
    return null;
  }
}
