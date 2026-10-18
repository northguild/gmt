import { Temporal } from "./temporal";
import type { Disambiguation } from "../types";
import { NANOSECONDS_PER_DAY } from "./foreignEpochs";
import { isNamedTimeZone } from "./zonedWallClock";
import { zonedNextTransition } from "./zonedWallClockOperations";
import type { ZoneFrame } from "./zoneFrame";

/**
 * The longest span one transition search covers: three 366-day years, the horizon the
 * polyfill-compatible search keeps with or without a limit (TC39 `GetNamedTimeZoneNextTransition`
 * leaves the horizon to the implementation). A search that passes `until` inside it is exact.
 */
const MAX_SEARCH_SPAN = 3n * 366n * NANOSECONDS_PER_DAY;

/**
 * A frame's offset as constant stretches over `[fromNs, toNs]`. `offsets[i]` holds from
 * `changes[i - 1]` (or `fromNs`) up to, not including, `changes[i]`; it includes
 * `frame.shiftNanoseconds`. Outside the range the first and last stretch are extended, so a
 * caller reads a time past `toNs` only after `extendTimeline`.
 */
export type OffsetTimeline = {
  frame: ZoneFrame;
  /** The first instant the timeline was built from. */
  fromNs: bigint;
  /** The last instant whose offset is known to be complete. */
  toNs: bigint;
  /** Epoch nanoseconds of each offset change, ascending. */
  changes: bigint[];
  offsets: bigint[];
};

/**
 * Build the timeline of `frame` over `[fromNs, toNs]`. A fixed-offset frame (an offset zone,
 * `UTC`, an offset with seconds) is one stretch and runs no search.
 *
 * Throws what Temporal throws for an instant outside its range; callers keep clear of it.
 */
export function offsetTimeline(
  frame: ZoneFrame,
  fromNs: bigint,
  toNs: bigint,
): OffsetTimeline {
  const first = new Temporal.ZonedDateTime(fromNs, frame.timeZone);
  const timeline: OffsetTimeline = {
    frame,
    fromNs,
    toNs: fromNs,
    changes: [],
    offsets: [BigInt(first.offsetNanoseconds) + frame.shiftNanoseconds],
  };

  extendTimeline(timeline, toNs);

  return timeline;
}

/**
 * Grow `timeline` so that it is complete up to `toNs`, one search of at most three years at a
 * time. Each search passes `until`, so it never stops at a clock-based horizon short of it.
 */
function extendTimeline(timeline: OffsetTimeline, toNs: bigint): void {
  const { frame } = timeline;

  if (toNs <= timeline.toNs) {
    return;
  }

  if (isNamedTimeZone(frame.timeZone)) {
    let chunkStart = timeline.toNs;

    while (chunkStart < toNs) {
      const chunkEnd =
        toNs - chunkStart > MAX_SEARCH_SPAN
          ? chunkStart + MAX_SEARCH_SPAN
          : toNs;
      let at = chunkStart;

      for (;;) {
        const next = zonedNextTransition(
          new Temporal.ZonedDateTime(at, frame.timeZone),
          chunkEnd,
        );

        if (next === null) {
          break;
        }

        timeline.changes.push(next.epochNanoseconds);
        timeline.offsets.push(
          BigInt(next.offsetNanoseconds) + frame.shiftNanoseconds,
        );
        at = next.epochNanoseconds;
      }

      chunkStart = chunkEnd;
    }
  }

  timeline.toNs = toNs;
}

/**
 * Make `timeline` complete up to `ns`, reading ahead so a walk that advances a day at a time
 * searches in chunks: it grows by at least its own length, up to three years.
 */
export function ensureTimeline(timeline: OffsetTimeline, ns: bigint): void {
  if (ns <= timeline.toNs) {
    return;
  }

  const length = timeline.toNs - timeline.fromNs;
  const step = length > MAX_SEARCH_SPAN ? MAX_SEARCH_SPAN : length;

  extendTimeline(
    timeline,
    ns > timeline.toNs + step ? ns : timeline.toNs + step,
  );
}

/** Index of the stretch holding `ns`: the number of changes at or before it. */
function stretchAt(timeline: OffsetTimeline, ns: bigint): number {
  const { changes } = timeline;
  let low = 0;
  let high = changes.length;

  while (low < high) {
    const middle = (low + high) >>> 1;

    if (changes[middle] <= ns) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

/** The offset in force at `ns`, in nanoseconds east of UTC. */
export function offsetOf(timeline: OffsetTimeline, ns: bigint): bigint {
  return timeline.offsets[stretchAt(timeline, ns)];
}

/**
 * TC39 `GetPossibleEpochNanoseconds`, read from the timeline: the instants whose wall clock is
 * `wallNs` (the wall clock read as UTC), ascending. A stretch contributes `wallNs - offset` when
 * that instant lies in the stretch; offsets differ by well under two days, so only the stretches
 * within two days either side can.
 */
export function possibleAt(timeline: OffsetTimeline, wallNs: bigint): bigint[] {
  const { changes, offsets } = timeline;
  const last = stretchAt(timeline, wallNs + 2n * NANOSECONDS_PER_DAY);
  const possible: bigint[] = [];

  for (
    let index = stretchAt(timeline, wallNs - 2n * NANOSECONDS_PER_DAY);
    index <= last;
    index++
  ) {
    const instant = wallNs - offsets[index];

    if (
      (index === 0 || instant >= changes[index - 1]) &&
      (index === changes.length || instant < changes[index])
    ) {
      possible.push(instant);
    }
  }

  return possible;
}

/**
 * TC39 `GetEpochNanosecondsFor`: the instant a wall clock names, by
 * `DisambiguatePossibleEpochNanoseconds`. One candidate is the answer; two give the first
 * (`"compatible"`, `"earlier"`) or last (`"later"`); none moves the wall clock by the offset
 * change, back for `"earlier"` and forward otherwise. `undefined` where `"reject"` refuses.
 * Throws `RangeError` where a moved wall clock names nothing, which no zone's data produces.
 */
export function resolveWallNs(
  timeline: OffsetTimeline,
  wallNs: bigint,
  disambiguation: Disambiguation,
): bigint | undefined {
  const possible = possibleAt(timeline, wallNs);

  if (possible.length === 1) {
    return possible[0];
  }

  if (disambiguation === "reject") {
    return undefined;
  }

  if (possible.length > 1) {
    return disambiguation === "later"
      ? possible[possible.length - 1]
      : possible[0];
  }

  const change =
    offsetOf(timeline, wallNs + NANOSECONDS_PER_DAY) -
    offsetOf(timeline, wallNs - NANOSECONDS_PER_DAY);
  const shifted = possibleAt(
    timeline,
    disambiguation === "earlier" ? wallNs - change : wallNs + change,
  );

  if (shifted.length === 0) {
    throw new RangeError("the wall clock cannot be resolved");
  }

  return disambiguation === "earlier"
    ? shifted[0]
    : shifted[shifted.length - 1];
}

/**
 * TC39 `GetStartOfDay`: the first instant of the local date `epochDay` days from 1970-01-01 -
 * its first candidate for midnight, else (midnight skipped) the change that ends the gap.
 */
export function startOfDayNs(
  timeline: OffsetTimeline,
  epochDay: number,
): bigint {
  const midnight = BigInt(epochDay) * NANOSECONDS_PER_DAY;
  const possible = possibleAt(timeline, midnight);

  if (possible.length > 0) {
    return possible[0];
  }

  const { changes } = timeline;

  return changes[stretchAt(timeline, midnight - NANOSECONDS_PER_DAY)];
}
