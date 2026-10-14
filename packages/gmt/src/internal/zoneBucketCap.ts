import { Temporal } from "@js-temporal/polyfill";
import type { ZoneBucketUnit } from "../types";
import { zonedNextTransition } from "./zonedWallClockOperations";

/**
 * A bounded walk over a zone's local buckets (hours, days, weeks, months) can refuse a span that is
 * certainly too long without stepping through it. `bucketRange` refuses a range past 10,000
 * buckets this way, and the free-time walk a dwell past 10,000 local days. `false` always means
 * "not certain": the caller walks, exactly as it would without this check, so no answer changes.
 */

const NANOSECONDS_PER_HOUR = 3_600_000_000_000n;

/**
 * The longest wall-clock stretch of each unit. Any wall-clock interval this long holds a unit
 * start: an hour holds an hour start, 24 hours a midnight, 7 days a Monday, 31 days a first of
 * the month.
 */
const LONGEST_UNIT_NANOSECONDS: Readonly<Record<ZoneBucketUnit, bigint>> = {
  hour: NANOSECONDS_PER_HOUR,
  day: 24n * NANOSECONDS_PER_HOUR,
  week: 168n * NANOSECONDS_PER_HOUR,
  month: 744n * NANOSECONDS_PER_HOUR,
};

/** Offset transitions read before the pre-count gives up and leaves the answer to the walk. */
const MAX_PRECOUNT_TRANSITIONS = 4_096;

/**
 * True when `[start, end)` certainly touches more than `max` buckets of `unit`, decided from the span
 * instead of stepping bucket by bucket (which costs milliseconds a step in some zones).
 *
 * Over a prefix of the range, the local wall clock runs continuously between offset transitions.
 * Those stretches cover at least the prefix's length less every backward offset change, in at most
 * one stretch more than there are transitions, and each stretch of wall clock holds at least
 * `floor(length / LONGEST_UNIT_NANOSECONDS)` distinct unit starts, each the start of its own
 * bucket before `end`. The count subtracts two per stretch for the partial units at its ends.
 * `false` means "not certain": the walk decides, exactly as before.
 */
export function certainlyTouchesMoreBuckets(
  startZoned: Temporal.ZonedDateTime,
  endZoned: Temporal.ZonedDateTime,
  unit: ZoneBucketUnit,
  max: number,
): boolean {
  const unitNs = LONGEST_UNIT_NANOSECONDS[unit];
  const startNs = startZoned.epochNanoseconds;
  const prefixEndNs = [
    endZoned.epochNanoseconds,
    startNs + 2n * BigInt(max + 1) * unitNs,
  ].reduce((a, b) => (a < b ? a : b));
  if (prefixEndNs - startNs <= BigInt(max) * unitNs) {
    return false;
  }
  let backwardNs = 0n;
  let transitions = 0;
  try {
    for (
      let current = startZoned, next = zonedNextTransition(current);
      next !== null && next.epochNanoseconds < prefixEndNs;
      current = next, next = zonedNextTransition(current)
    ) {
      if (++transitions > MAX_PRECOUNT_TRANSITIONS) {
        return false;
      }
      const shift = BigInt(current.offsetNanoseconds - next.offsetNanoseconds);
      backwardNs += shift > 0n ? shift : 0n;
    }
  } catch {
    return false;
  }
  const wallStarts = (prefixEndNs - startNs - backwardNs) / unitNs;
  return wallStarts - 2n * BigInt(transitions + 1) > BigInt(max);
}
