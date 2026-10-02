import {
  isObject,
  parseInstantNanoseconds,
  parsePunctualityTolerance,
  punctualityOf,
} from "../../internal";
import type { PunctualityTolerance } from "../../types";

/** One planned/actual pair for `punctualityRate`. */
export interface PlannedActual {
  /** ISO 8601 instant or zoned datetime string of the planned time. */
  planned: string;
  /** ISO 8601 instant or zoned datetime string of the actual time. */
  actual: string;
}

/** What `punctualityRate` returns: the on-time count, the total, and their ratio. */
export interface OnTimeRate {
  /** Pairs `classifyPunctuality` calls `"onTime"`. */
  onTime: number;
  /** Every pair counted. */
  total: number;
  /** `onTime / total`, from 0 to 1. */
  rate: number;
}

/**
 * The share of planned/actual pairs that were on time under one tolerance.
 *
 * A rate is a count under a stated tolerance: the same arrivals give a different rate under a
 * 60-minute tolerance than under a 120-minute one, so the tolerance travels with the number.
 *
 * - Each pair is classified by `classifyPunctuality`'s rule under the same tolerance: `late` and
 *   `early` are read once, before any pair, so the whole list is judged under one tolerance.
 *   Only `"onTime"` counts: with an `early` tolerance, an early arrival is **not** on time;
 *   without one, it is.
 * - `rate` is `onTime / total` as a plain number (`0.75`), not rounded.
 * - Every pair must be valid: one invalid pair returns `null`, never a rate over the rest.
 * - An empty list returns `null`: no arrivals have no rate.
 * - Anything beyond a rate — percentiles, causes — is the consumer's.
 *
 * @param pairs the planned and actual time of each arrival
 * @param tolerance late (required) and early (optional) tolerances, as classifyPunctuality takes them
 * @returns the on-time count, the total and the rate (null for an empty list), or null on invalid input
 *
 * @example punctualityRate([{ planned: "2024-06-15T10:00:00Z", actual: "2024-06-15T10:05:00Z" }, { planned: "2024-06-15T10:00:00Z", actual: "2024-06-15T10:14:00Z" }, { planned: "2024-06-15T10:00:00Z", actual: "2024-06-15T10:16:00Z" }, { planned: "2024-06-15T10:00:00Z", actual: "2024-06-15T09:57:00Z" }], { late: "PT15M" }) // { onTime: 3, total: 4, rate: 0.75 }
 * @example punctualityRate([{ planned: "2024-06-15T10:00:00Z", actual: "2024-06-15T09:48:00Z" }, { planned: "2024-06-15T10:00:00Z", actual: "2024-06-15T10:01:00Z" }], { late: "PT15M", early: "PT10M" }) // { onTime: 1, total: 2, rate: 0.5 } (12 minutes early is not on time under a 10-minute early tolerance)
 * @example punctualityRate([], { late: "PT15M" }) // null
 * @example punctualityRate([{ planned: "2024-06-15T10:00:00Z", actual: "2024-06-15T10:05:00" }], { late: "PT15M" }) // null (a zoneless actual is not a moment)
 */
export function punctualityRate(
  pairs: PlannedActual[],
  tolerance: PunctualityTolerance,
): OnTimeRate | null {
  try {
    if (!Array.isArray(pairs) || pairs.length === 0) {
      return null;
    }
    // Read once: every pair is judged under the same tolerance, whatever a getter returns later.
    const bounds = parsePunctualityTolerance(tolerance);
    if (bounds === null) {
      return null;
    }

    let onTime = 0;
    for (const pair of pairs) {
      if (!isObject(pair)) {
        return null;
      }
      const { planned, actual } = pair as PlannedActual;
      const plannedNanoseconds = parseInstantNanoseconds(planned);
      const actualNanoseconds = parseInstantNanoseconds(actual);
      if (plannedNanoseconds === null || actualNanoseconds === null) {
        return null;
      }
      if (
        punctualityOf(actualNanoseconds - plannedNanoseconds, bounds) ===
        "onTime"
      ) {
        onTime += 1;
      }
    }

    return { onTime, total: pairs.length, rate: onTime / pairs.length };
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
