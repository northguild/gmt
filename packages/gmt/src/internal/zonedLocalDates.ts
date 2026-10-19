import type { Temporal } from "./temporal";

import { floorDivide } from "./floorDivide";
import { NANOSECONDS_PER_DAY } from "./foreignEpochs";
import { offsetTimeline } from "./offsetTimeline";

/**
 * Transitions walked while collecting local dates, matching `countZonedBuckets`' cap: roughly
 * 5,000 years of twice-yearly daylight saving; a longer walk answers with the sentinel.
 */
const MAX_WALKED_TRANSITIONS = 10_000;

/** The local date, in days from 1970-01-01, of an instant at `offset` east of UTC. */
function localDay(ns: bigint, offset: bigint): number {
  return Number(floorDivide(ns + offset, NANOSECONDS_PER_DAY));
}

/** Size of the union of inclusive integer ranges. */
function unionSize(ranges: Array<[number, number]>): number {
  const sorted = [...ranges].sort((x, y) => x[0] - y[0]);
  let total = 0;
  let [runStart, runEnd] = sorted[0];

  for (const [from, to] of sorted.slice(1)) {
    if (from > runEnd + 1) {
      total += runEnd - runStart + 1;
      [runStart, runEnd] = [from, to];
    } else if (to > runEnd) {
      runEnd = to;
    }
  }

  return total + runEnd - runStart + 1;
}

/**
 * Count the distinct local (ISO) dates of the instants in the closed span `[start, end]`, in
 * `start`'s time zone. `end` must already be expressed in that zone and not precede `start`.
 *
 * Between two zone transitions the wall clock runs continuously, so every date from a run's
 * first to its last instant is touched. A transition can jump the clock past a whole date
 * (`Pacific/Apia` deleted 2011-12-30), which no instant then has, or back into the previous
 * date (`America/Goose_Bay` at 00:01 on 2010-11-07), which is touched again but counted once.
 *
 * @param start the span start
 * @param end the span end, in `start`'s zone
 * @returns the number of distinct local dates, or null past `MAX_WALKED_TRANSITIONS` transitions
 */
export function countZonedLocalDates(
  start: Temporal.ZonedDateTime,
  end: Temporal.ZonedDateTime,
): number | null {
  const timeline = offsetTimeline(
    { timeZone: start.timeZoneId, shiftNanoseconds: 0n },
    start.epochNanoseconds,
    end.epochNanoseconds,
    MAX_WALKED_TRANSITIONS,
  );

  if (timeline === null) {
    return null;
  }

  const { changes, offsets } = timeline;
  const endNs = end.epochNanoseconds;
  const ranges: Array<[number, number]> = [];
  let runStart = start.epochNanoseconds;

  // One stretch per offset change in the span, which the cap above bounds.
  for (let index = 0; index <= changes.length; index++) {
    const runEnd = index === changes.length ? endNs : changes[index] - 1n;

    ranges.push([
      localDay(runStart, offsets[index]),
      localDay(runEnd, offsets[index]),
    ]);
    runStart = changes[index];
  }

  return unionSize(ranges);
}
