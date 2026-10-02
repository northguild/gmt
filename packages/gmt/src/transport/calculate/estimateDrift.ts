import {
  formatHourDuration,
  isOptionsArgument,
  nonNegativeExactDurationNanoseconds,
  parseTimestampEvents,
} from "../../internal";
import type { TimestampEvent } from "../../types";

/** Options for `estimateDrift`. */
export interface EstimateDriftOptions {
  /**
   * The drift allowed, as an ISO 8601 duration of exact time (a day is 24 hours; years, months and
   * weeks are refused; not negative). With it, `exceedsTolerance` says whether the drift is greater
   * than it.
   *
   * @defaultValue None. `exceedsTolerance` is `null`.
   */
  tolerance?: string;
}

/** What `estimateDrift` returns. */
export interface DriftReport {
  /** The earliest-recorded EST's `at`, exactly as written. */
  first: string;
  /** The latest-recorded EST's `at`, exactly as written. */
  last: string;
  /**
   * The drift: `last` minus `first` in exact time, hours as the largest unit; negative when it
   * moved earlier.
   */
  drift: string;
  /** The number of EST records, the first included. */
  revisions: number;
  /** Whether the absolute drift is greater than `tolerance`; `null` without a tolerance. */
  exceedsTolerance: boolean | null;
}

/**
 * Measure how far an estimate moved between its first and last revision.
 *
 * Schedule-reliability reporting asks how much an estimated arrival slid while it was being
 * revised, and a revision far enough from the first estimate means something must be redone:
 * rebooked, re-planned, renotified. The threshold is the caller's; the consequence is the
 * consumer's.
 *
 * - Only `EST` records are read, in the order they were recorded (`recordedAt`). Two records at
 *   the same instant are ordered by their place in the array, the later one last — the same tie
 *   rule as `bestAvailable`. `PLN`, `REQ` and `ACT` records are validated and otherwise ignored.
 * - `revisions` is the number of EST records, the first included.
 * - `drift` is the last EST's `at` minus the first's, in exact elapsed time with hours as the
 *   largest unit: positive when the estimate moved later, negative when earlier. Across a
 *   fall-back night, 01:30 EDT to 01:30 EST is `PT1H`.
 * - With `tolerance`, `exceedsTolerance` is `true` when the drift, in either direction, is
 *   **greater** than the tolerance; exactly the tolerance is `false`. Without it, `null`.
 * - `first` and `last` echo `at` exactly as written; both are instants (`Z`/offset) or zoned
 *   strings compared as instants, read as `scheduleDeviation` reads them: the offset fixes the
 *   instant, and an offset written to the minute that is the bracketed zone's sub-minute offset
 *   rounded (`-00:45[Africa/Monrovia]`, for −00:44:30) names the instant the zone gives.
 *   Otherwise the bracket is not checked.
 * - Returns `null` with fewer than two EST records — there is no drift from one sample — and on
 *   invalid input: any invalid event, of any class, or an invalid, negative or calendar-unit
 *   `tolerance`.
 *
 * @param events the event's timestamp records, in any order
 * @param options The threshold the absolute drift is compared with
 * @returns the first and last estimates, the drift, the revision count and the tolerance check (null with fewer than two EST records), or null on invalid input
 *
 * @example estimateDrift([{ classifier: "EST", at: "2024-06-20T08:00:00Z", recordedAt: "2024-06-01T00:00:00Z" }, { classifier: "EST", at: "2024-06-20T12:00:00Z", recordedAt: "2024-06-05T00:00:00Z" }, { classifier: "EST", at: "2024-06-20T17:00:00Z", recordedAt: "2024-06-10T00:00:00Z" }]) // { first: "2024-06-20T08:00:00Z", last: "2024-06-20T17:00:00Z", drift: "PT9H", revisions: 3, exceedsTolerance: null }
 * @example estimateDrift([{ classifier: "EST", at: "2024-06-20T17:00:00Z", recordedAt: "2024-06-01T00:00:00Z" }, { classifier: "EST", at: "2024-06-20T08:00:00Z", recordedAt: "2024-06-10T00:00:00Z" }], { tolerance: "PT8H" }) // { first: "2024-06-20T17:00:00Z", last: "2024-06-20T08:00:00Z", drift: "-PT9H", revisions: 2, exceedsTolerance: true } (nine hours earlier exceeds eight)
 * @example estimateDrift([{ classifier: "EST", at: "2024-06-20T08:00:00Z", recordedAt: "2024-06-01T00:00:00Z" }, { classifier: "EST", at: "2024-06-20T15:00:00Z", recordedAt: "2024-06-10T00:00:00Z" }], { tolerance: "PT8H" }) // { first: "2024-06-20T08:00:00Z", last: "2024-06-20T15:00:00Z", drift: "PT7H", revisions: 2, exceedsTolerance: false }
 * @example estimateDrift([{ classifier: "EST", at: "2024-06-20T08:00:00Z", recordedAt: "2024-06-01T00:00:00Z" }]) // null (no drift from one sample)
 * @example estimateDrift([{ classifier: "EST", at: "2024-06-20T08:00:00Z", recordedAt: "2024-06-01T00:00:00Z" }, { classifier: "EST", at: "2024-06-20T15:00:00Z", recordedAt: "2024-06-10T00:00:00Z" }], { tolerance: "P1W" }) // null (weeks need a reference point)
 */
export function estimateDrift(
  events: TimestampEvent[],
  options?: EstimateDriftOptions,
): DriftReport | null {
  try {
    if (!isOptionsArgument(options)) {
      return null;
    }
    const tolerance = options?.tolerance;
    const toleranceNanoseconds =
      tolerance === undefined
        ? null
        : nonNegativeExactDurationNanoseconds(tolerance);
    if (tolerance !== undefined && toleranceNanoseconds === null) {
      return null;
    }

    const parsed = parseTimestampEvents(events);
    if (parsed === null) {
      return null;
    }
    const estimates = parsed.filter((event) => event.classifier === "EST");
    const first = estimates[0];
    const last = estimates[estimates.length - 1];
    if (estimates.length < 2 || first === undefined || last === undefined) {
      return null;
    }

    const drift = last.atNanoseconds - first.atNanoseconds;
    const magnitude = drift < 0n ? -drift : drift;
    return {
      first: first.at,
      last: last.at,
      drift: `${drift < 0n ? "-" : ""}${formatHourDuration(magnitude)}`,
      revisions: estimates.length,
      exceedsTolerance:
        toleranceNanoseconds === null ? null : magnitude > toleranceNanoseconds,
    };
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
