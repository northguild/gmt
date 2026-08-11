import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";

/**
 * Return the candidate date nearest to `target` by calendar distance.
 *
 * - Distance is measured in whole days using `Temporal.PlainDate.compare`.
 * - Returns `null` if the candidates array is empty or contains no valid dates.
 * - Returns `null` if `target` is invalid.
 * - On a tie (two equidistant candidates), returns the first one in array order.
 *
 * @param target ISO PlainDate string to measure distance from
 * @param candidates Array of ISO PlainDate strings to choose from
 * @returns The nearest candidate date string, or null on invalid input
 *
 * @example closestDateTo("2024-03-15", ["2024-03-01", "2024-03-20", "2024-03-18"]) // "2024-03-18"
 * @example closestDateTo("2024-03-15", ["2024-03-01", "2024-03-29"]) // "2024-03-01"
 * @example closestDateTo("2024-03-15", []) // null
 * @example closestDateTo("invalid", ["2024-03-01"]) // null
 */
export function closestDateTo(
  target: string,
  candidates: string[],
): string | null {
  if (
    !isValidDate(target) ||
    !candidates.length ||
    !candidates.some(isValidDate)
  ) {
    return null;
  }

  try {
    const t = Temporal.PlainDate.from(target);
    const validCandidates = candidates.filter(isValidDate);

    const parsed = validCandidates.map((c) => ({
      str: c,
      date: Temporal.PlainDate.from(c),
    }));

    const closest = parsed.reduce((best, candidate) => {
      const bestDist = Math.abs(t.until(best.date).days);
      const candDist = Math.abs(t.until(candidate.date).days);
      return candDist < bestDist ? candidate : best;
    }, parsed[0]);

    return closest.str;
  } catch {
    return null;
  }
}
