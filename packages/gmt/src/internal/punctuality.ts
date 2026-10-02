import type { Punctuality } from "../types";
import { nonNegativeExactDurationNanoseconds } from "./exactDuration";
import { isObject } from "./isObject";

/** A `PunctualityTolerance` as non-negative exact nanoseconds; `early` is `null` when absent. */
export type ToleranceNanoseconds = { late: bigint; early: bigint | null };

/**
 * Read a `PunctualityTolerance` once into exact nanoseconds, or `null` when it is invalid.
 *
 * - `late` and `early` are each read exactly once, so a caller that classifies many pairs under
 *   one tolerance really uses one tolerance, whatever a getter returns on a later read.
 * - Each bound is an exact duration (a day is 24 hours; years, months and weeks refused) and not
 *   negative (`-PT0S` is zero). `late` is required; `early: undefined` is absent and
 *   `early: null` is invalid.
 * - A hostile value (a throwing getter, a revoked Proxy) is invalid input: `null`, never a throw.
 *
 * @param tolerance candidate `{ late, early? }`
 * @returns the bounds in nanoseconds, or null on invalid input
 *
 * @example parsePunctualityTolerance({ late: "PT15M" }) // { late: 900000000000n, early: null }
 * @example parsePunctualityTolerance({ late: "-PT15M" }) // null
 */
export function parsePunctualityTolerance(
  tolerance: unknown,
): ToleranceNanoseconds | null {
  try {
    if (!isObject(tolerance)) {
      return null;
    }
    const { late, early } = tolerance as { late?: unknown; early?: unknown };
    const lateNanoseconds = nonNegativeExactDurationNanoseconds(late);
    const earlyNanoseconds =
      early === undefined ? null : nonNegativeExactDurationNanoseconds(early);
    if (
      lateNanoseconds === null ||
      (early !== undefined && earlyNanoseconds === null)
    ) {
      return null;
    }
    return { late: lateNanoseconds, early: earlyNanoseconds };
  } catch {
    return null;
  }
}

/**
 * Classify a deviation (actual − planned, exact nanoseconds) against a tolerance.
 *
 * Late when the deviation is `late` or more; early when `early` is set and the deviation is
 * `-early` or less; on time strictly between. Late is checked first, so with both bounds zero the
 * plan itself is late.
 *
 * @param deviation actual minus planned, in nanoseconds
 * @param tolerance the bounds from `parsePunctualityTolerance`
 * @returns "early", "onTime" or "late"
 *
 * @example punctualityOf(900000000000n, { late: 900000000000n, early: null }) // "late"
 * @example punctualityOf(0n, { late: 900000000000n, early: 0n }) // "early"
 */
export function punctualityOf(
  deviation: bigint,
  tolerance: ToleranceNanoseconds,
): Punctuality {
  if (deviation >= tolerance.late) {
    return "late";
  }
  if (tolerance.early !== null && deviation <= -tolerance.early) {
    return "early";
  }
  return "onTime";
}
