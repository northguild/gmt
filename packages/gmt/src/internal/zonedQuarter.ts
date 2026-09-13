import type { Temporal } from "@js-temporal/polyfill";
import { nextZonedBucketStart, zonedUnitStart } from "./zonedBucket";

/**
 * Month buckets walked while finding a quarter's edge.
 *
 * A quarter is three local months, and a transition that re-opens a month's label (Tunis went
 * back from 00:59:59 to 00:00 on 1978-10-01) splits that month into two buckets, so even the
 * worst case is six. Twelve leaves room without letting a broken walk run on.
 */
const MAX_QUARTER_MONTH_BUCKETS = 12;

/** The local calendar quarter `zoned` falls in, as a comparable label. */
function quarterLabel(zoned: Temporal.ZonedDateTime): string {
  return `${zoned.year}-${Math.ceil(zoned.month / 3)}`;
}

/**
 * Return the start of the local calendar quarter containing `zoned`: the first month bucket
 * (see `zonedUnitStart`) still labelled with `zoned`'s quarter.
 *
 * - Walks back one real month bucket at a time rather than re-resolving a wall-clock
 *   quarter start, so a repeated first hour answers with its first pass and a skipped one with
 *   the quarter's first real instant.
 * - Returns null if a month bucket cannot be found, or the walk runs out of
 *   `MAX_QUARTER_MONTH_BUCKETS` without leaving the quarter.
 */
export function zonedQuarterStart(
  zoned: Temporal.ZonedDateTime,
): Temporal.ZonedDateTime | null {
  const label = quarterLabel(zoned);
  let first = zonedUnitStart(zoned, "month");

  for (let i = 0; first && i < MAX_QUARTER_MONTH_BUCKETS; i++) {
    const previous = zonedUnitStart(
      first.subtract({ nanoseconds: 1 }),
      "month",
    );

    if (!previous) return null;
    if (quarterLabel(previous) !== label) return first;

    first = previous;
  }

  return null;
}

/**
 * Return the last instant of the local calendar quarter containing `zoned`: one nanosecond
 * before the first month bucket labelled with the next quarter.
 *
 * - Walks forward one real month bucket at a time (see `nextZonedBucketStart`), so the result
 *   is never earlier than `zoned`: a repeated last hour ends with its second pass.
 * - Returns null if a month bucket cannot be found, or the walk runs out of
 *   `MAX_QUARTER_MONTH_BUCKETS` without leaving the quarter.
 */
export function zonedQuarterEnd(
  zoned: Temporal.ZonedDateTime,
): Temporal.ZonedDateTime | null {
  const label = quarterLabel(zoned);
  let current = zonedUnitStart(zoned, "month");

  for (let i = 0; current && i < MAX_QUARTER_MONTH_BUCKETS; i++) {
    const next = nextZonedBucketStart(current, "month");

    if (!next) return null;
    if (quarterLabel(next) !== label) return next.subtract({ nanoseconds: 1 });

    current = next;
  }

  return null;
}
