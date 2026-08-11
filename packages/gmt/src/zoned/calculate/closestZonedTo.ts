import { Temporal } from "@js-temporal/polyfill";

import { isValidZonedDateTime } from "../validate";

/**
 * Return the candidate zoned datetime nearest to `target` by temporal distance.
 *
 * - Distance is measured in total days using `Temporal.Instant` epoch milliseconds.
 * - Returns `null` if the candidates array is empty or contains no valid dates.
 * - Returns `null` if `target` is invalid.
 * - On a tie (two equidistant candidates), returns the first one in array order.
 *
 * @param target ISO ZonedDateTime string to measure distance from
 * @param candidates Array of ISO ZonedDateTime strings to choose from
 * @returns The nearest candidate zoned datetime string, or null on invalid input
 *
 * @example closestZonedTo("2024-03-15T12:00:00+00:00[UTC]", ["2024-03-01T00:00:00+00:00[UTC]", "2024-03-20T00:00:00+00:00[UTC]", "2024-03-18T00:00:00+00:00[UTC]"]) // "2024-03-18T00:00:00+00:00[UTC]"
 * @example closestZonedTo("2024-03-15T12:00:00+00:00[UTC]", ["2024-03-01T00:00:00+00:00[UTC]", "2024-03-29T00:00:00+00:00[UTC]"]) // "2024-03-29T00:00:00+00:00[UTC]"
 * @example closestZonedTo("2024-03-15T12:00:00+00:00[UTC]", []) // null
 * @example closestZonedTo("invalid", ["2024-03-01T00:00:00+00:00[UTC]"]) // null
 */
export function closestZonedTo(
  target: string,
  candidates: string[],
): string | null {
  if (!isValidZonedDateTime(target) || !candidates.length) {
    return null;
  }

  try {
    const t = Temporal.ZonedDateTime.from(target);
    const validCandidates = candidates.filter(isValidZonedDateTime);

    if (!validCandidates.length) {
      return null;
    }

    const parsed = validCandidates.map((c) => ({
      str: c,
      date: Temporal.ZonedDateTime.from(c),
    }));

    const closest = parsed.reduce((best, candidate) => {
      const bestDist =
        Math.abs(
          best.date.toInstant().epochMilliseconds -
            t.toInstant().epochMilliseconds,
        ) / 86400000;
      const candDist =
        Math.abs(
          candidate.date.toInstant().epochMilliseconds -
            t.toInstant().epochMilliseconds,
        ) / 86400000;
      return candDist < bestDist ? candidate : best;
    }, parsed[0]);

    return closest.date.toString();
  } catch {
    return null;
  }
}
