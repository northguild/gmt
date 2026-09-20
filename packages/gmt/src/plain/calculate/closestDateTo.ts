import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";

/**
 * Return the candidate date nearest to `target` by calendar distance.
 *
 * - Distance is the absolute whole-day count `Math.abs(target.until(candidate).days)`.
 *   `Temporal.PlainDate.compare` is not used for it: `compare` orders two dates (`-1`, `0`,
 *   `1`), it does not measure between them. `until()` on a `PlainDate` defaults to
 *   `largestUnit: "day"`, so the count runs across month and year boundaries —
 *   `2024-03-15` to `2026-01-01` is `657`.
 * - Returns `""` if the candidates array is empty or contains no valid dates, or `target` is invalid.
 * - **Compatibility:** before 1.16.0 invalid input returned `null`.
 * - On a tie (two equidistant candidates), returns the first one in array order.
 *
 * @param target ISO PlainDate string to measure distance from
 * @param candidates Array of ISO PlainDate strings to choose from
 * @returns The nearest candidate date string, or "" on invalid input
 *
 * @example closestDateTo("2024-03-15", ["2024-03-01", "2024-03-20", "2024-03-18"]) // "2024-03-18"
 * @example closestDateTo("2024-03-15", ["2024-03-01", "2024-03-29"]) // "2024-03-01"
 * @example closestDateTo("2024-03-15", []) // ""
 * @example closestDateTo("invalid", ["2024-03-01"]) // ""
 */
export function closestDateTo(target: string, candidates: string[]): string {
  if (
    !isValidDate(target) ||
    !Array.isArray(candidates) ||
    !candidates.length ||
    !candidates.some(isValidDate)
  ) {
    return "";
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
    return "";
  }
}
