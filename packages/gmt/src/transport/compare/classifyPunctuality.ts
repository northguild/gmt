import {
  parseInstantNanoseconds,
  parsePunctualityTolerance,
  punctualityOf,
} from "../../internal";
import type { Punctuality, PunctualityTolerance } from "../../types";

/**
 * Classify an arrival as early, on time or late against the caller's tolerance.
 *
 * "On time" without a stated tolerance is not a measurement, and the tolerance differs by mode:
 * a 15-minute tolerance (`{ late: "PT15M" }`), a 60/120-minute pair compared side by side, or a
 * day-based one (`{ late: "P1D", early: "P1D" }`). GMT holds no default; the caller states it.
 *
 * - The deviation is `scheduleDeviation`'s: `actual` minus `planned` in exact elapsed time, so a
 *   delay across a DST transition is measured in real minutes, never wall-clock ones.
 * - **Late** when the deviation is `late` or more: exactly 15 minutes against `PT15M` is late.
 * - **Early** when `early` is given and the deviation is `-early` or less: exactly 10 minutes
 *   early against `PT10M` is early.
 * - **On time** only strictly inside the tolerance: after `-early` (when given) and before
 *   `late`. Both boundaries belong to the outside. This convention is GMT's own, stated here, not
 *   a reading of any rule.
 * - **Without `early`, every early arrival is on time.** `early: undefined` is the same as
 *   leaving it out; `early: null` is invalid.
 * - `late: "PT0S"` leaves no on-time window after the plan: an arrival exactly on the plan is
 *   late. `early: "PT0S"` leaves none before it: an arrival exactly on the plan is early (with a
 *   non-zero `late`), because both boundaries are outside the on-time window. With both at
 *   `"PT0S"`, nothing is on time; late is checked first, so the plan itself is late.
 * - Tolerances are exact durations: a day is 24 hours; years, months and weeks return `null`, as
 *   does a negative tolerance (`-PT0S` is zero).
 * - Both times are an instant (`Z`/offset) or a zoned string; a bracketed zone is not read.
 * - Returns `null` on invalid input.
 *
 * @param planned ISO 8601 instant or zoned datetime string of the planned time
 * @param actual ISO 8601 instant or zoned datetime string of the actual time
 * @param tolerance late (required) and early (optional) tolerances as ISO 8601 durations of exact time
 * @returns "early", "onTime" or "late", or null on invalid input
 *
 * @example classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T10:14:59Z", { late: "PT15M" }) // "onTime"
 * @example classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T10:15:00Z", { late: "PT15M" }) // "late" (exactly the tolerance is late)
 * @example classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T08:00:00Z", { late: "PT15M" }) // "onTime" (without early, an early arrival is on time)
 * @example classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T09:49:00Z", { late: "PT15M", early: "PT10M" }) // "early"
 * @example classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T11:30:00Z", { late: "PT120M" }) // "onTime" (a 90-minute delay under a 120-minute tolerance)
 * @example classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T10:00:00Z", { late: "PT15M", early: "PT0S" }) // "early" (exactly on the plan is on the early boundary, which is outside)
 * @example classifyPunctuality("2024-11-03T01:30:00-04:00[America/New_York]", "2024-11-03T01:30:00-05:00[America/New_York]", { late: "PT15M" }) // "late" (the same wall time an hour later, across the fall-back)
 * @example classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T10:14:00Z", { late: "-PT15M" }) // null (a negative tolerance)
 * @example classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T10:14:00Z", { late: "P1W" }) // null (weeks need a reference point)
 */
export function classifyPunctuality(
  planned: string,
  actual: string,
  tolerance: PunctualityTolerance,
): Punctuality | null {
  try {
    const bounds = parsePunctualityTolerance(tolerance);
    if (bounds === null) {
      return null;
    }

    const plannedNanoseconds = parseInstantNanoseconds(planned);
    const actualNanoseconds = parseInstantNanoseconds(actual);
    if (plannedNanoseconds === null || actualNanoseconds === null) {
      return null;
    }

    return punctualityOf(actualNanoseconds - plannedNanoseconds, bounds);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
