import {
  MAX_EPOCH_NANOSECONDS,
  MIN_EPOCH_NANOSECONDS,
} from "./epochNanoseconds";
import {
  POLYFILL_TRANSITION_SEARCH_FLOOR,
  missedNextTransition,
  missedPreviousTransition,
  offsetAt,
  transitionBetween,
} from "./zonedWallClock";
import { nowInstant } from "./temporalCompat";

/*
 * ---------------------------------------------------------------------------------------------
 * GMT's own time zone transition search (temporalCompat D13; `zonedWallClock.ts` defect 5)
 * ---------------------------------------------------------------------------------------------
 * TC39 `GetNamedTimeZoneNextTransition` / `GetNamedTimeZonePreviousTransition`: the first offset
 * change strictly after an instant, and the last strictly before it. `@js-temporal/polyfill`
 * 0.5.1 samples the offset every 14 days and bisects a step whose ends differ. Two changes inside
 * one step break it: a pair that returns to the same offset is skipped (America/Boa_Vista,
 * 2000-10-08 and 2000-10-15), and three different offsets make its bisection loop forever
 * (Europe/Riga, 1944-10-02 and 1944-10-12).
 *
 * This search samples the same way with a step shorter than any gap between two changes in the
 * tz database, so a step holds at most one change: equal ends mean none, different ends mean
 * exactly one, and bisecting it always narrows.
 *
 * The sampling assumption, pinned by the all-zones guard in `zonedTransitionSearch.test.ts`: no
 * zone changes its offset twice within `TRANSITION_SEARCH_STEP_NANOSECONDS`. The closest pair in
 * tz 2026c is 601,200 s apart (America/Boa_Vista, Noronha and Recife in 2000; Asia/Gaza and
 * Asia/Hebron in 2040), measured with `zdump -v`. The step is 432,000 s (5 days), 169,200 s
 * under that. A tz release with a closer pair fails the guard.
 *
 * "No further change" follows the polyfill's own rule, so removal changes no answer: a forward
 * search stops three 366-day years past the later of its start and the current instant, and a
 * backward search stops at 1847-01-01, before which the one earlier change a zone can have is
 * found by comparing offsets (`missedNextTransition`, `missedPreviousTransition`).
 *
 * Bounds, in offset reads (one `Intl` read each):
 * - a limit instant only shortens a search; the horizon above applies with or without one, so a
 *   limit thousands of years away costs no more than none. Within the horizon: one read per 5
 *   days of the limit, plus at most 51 to pin the change. The daylight rule passes 365 days: at
 *   most 74 + 51 reads.
 * - forward: at most the steps from the start (1847 at the earliest) to three years past the later
 *   of the start and today, about 13,400 from 1847 and 220 from any later start; a system clock
 *   set absurdly far ahead stops at `MAX_SEARCH_STEPS` (200,000) with a RangeError.
 * - backward: the same span, down to 1847. From more than three years past today: 220 reads over
 *   the three years before the instant; if nothing is there, one backward search from three years
 *   past today and then at most `MAX_TABLED_TRANSITIONS` (1,000) forward searches, then a
 *   RangeError.
 *
 * Removed with the D13 workaround: see `temporalCompat/README.md`.
 * ---------------------------------------------------------------------------------------------
 */

const NANOSECONDS_PER_SECOND = 1_000_000_000n;
const NANOSECONDS_PER_DAY = 86_400n * NANOSECONDS_PER_SECOND;

/**
 * The sampling step: 5 days. It must stay under the smallest gap between two offset changes of
 * one zone, 601,200 s in tz 2026c (`zdump -v`, America/Boa_Vista 2000-10-08 to 2000-10-15).
 */
export const TRANSITION_SEARCH_STEP_NANOSECONDS =
  432_000n * NANOSECONDS_PER_SECOND;

/**
 * js-temporal `GetNamedTimeZoneNextTransition`: "the farthest that we'll look for a next
 * transition is 3 years after the later of epochNanoseconds or the current time"
 * (`DAY_MS * 366 * 3`).
 */
const NO_FURTHER_TRANSITION_HORIZON_NANOSECONDS =
  3n * 366n * NANOSECONDS_PER_DAY;

/** Steps one search may take: 200,000 five-day steps is 2,700 years. */
const MAX_SEARCH_STEPS = 200_000;
/** Forward searches when walking a zone's tabled future changes; Africa/Casablanca has about 120. */
const MAX_TABLED_TRANSITIONS = 1_000;
/** Halvings to pin a whole second inside one step: 2^19 s is more than 5 days. */
const MAX_SECOND_BISECTION_STEPS = 20;

function minimum(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

function maximum(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

function floorSecond(epochNanoseconds: bigint): bigint {
  const seconds = epochNanoseconds / NANOSECONDS_PER_SECOND;
  return epochNanoseconds % NANOSECONDS_PER_SECOND < 0n
    ? seconds - 1n
    : seconds;
}

/**
 * The one change in `(low, high]`, given that the offsets at the two ends differ and the window is
 * no longer than a step. tz changes fall on whole seconds (RFC 9636 §3.2 stores transition times in
 * seconds), so the search runs over seconds; the result is checked one nanosecond earlier, and a
 * change that is not on a whole second is pinned to the nanosecond instead.
 */
function changeBetween(
  timeZone: string,
  low: bigint,
  high: bigint,
  lowOffset: bigint,
  highOffset: bigint,
): bigint {
  let before = floorSecond(low);
  let after = floorSecond(high);

  for (let i = 0; i < MAX_SECOND_BISECTION_STEPS && after - before > 1n; i++) {
    const middle = (before + after) / 2n;
    if (offsetAt(timeZone, middle * NANOSECONDS_PER_SECOND) === lowOffset) {
      before = middle;
    } else {
      after = middle;
    }
  }

  const change = after * NANOSECONDS_PER_SECOND;
  if (
    after - before === 1n &&
    change > low &&
    offsetAt(timeZone, change) === highOffset &&
    offsetAt(timeZone, change - 1n) === lowOffset
  ) {
    return change;
  }

  return transitionBetween(timeZone, low, high, highOffset);
}

/*
 * The per-zone memo: spans of a zone's timeline where this search has proved
 * which instants carry an offset change. An offset is a pure function of zone and instant for the
 * life of the process, so a memo holds observations of it and never a conclusion about the clock:
 * a "none up to the horizon" answer is not stored, only the stretch that was actually searched.
 * Removed with the D13 workaround: see `temporalCompat/README.md`.
 */

/** Proven: within (low, high] the zone changes offset exactly at `changes` (sorted), nowhere else. */
type KnownSpan = { low: bigint; high: bigint; changes: bigint[] };
type ZoneFacts = { spans: KnownSpan[] };

/** Zones remembered; the oldest is dropped past this. */
const MAX_MEMO_ZONES = 64;
/** Changes remembered per zone; past this the zone's facts are cleared. */
const MAX_MEMO_CHANGES = 4_096;
/** Spans remembered per zone; past this the zone's facts are cleared. */
const MAX_MEMO_SPANS = 256;

const transitionMemo = new Map<string, ZoneFacts>();

/** Forget every remembered span. Internal; tests call it to start from a cold memo. */
export function clearTransitionMemo(): void {
  transitionMemo.clear();
}

/** Two sorted arrays merged into one sorted array, a value in both kept once. */
function mergeSorted(a: bigint[], b: bigint[]): bigint[] {
  const merged: bigint[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const left = a[i] as bigint;
    const right = b[j] as bigint;
    if (left < right) {
      merged.push(left);
      i++;
    } else if (left > right) {
      merged.push(right);
      j++;
    } else {
      merged.push(left);
      i++;
      j++;
    }
  }
  while (i < a.length) merged.push(a[i++] as bigint);
  while (j < b.length) merged.push(b[j++] as bigint);
  return merged;
}

/** Remember that (low, high] changes offset exactly at `changes` and nowhere else. */
function recordSpan(
  timeZone: string,
  low: bigint,
  high: bigint,
  changes: bigint[],
): void {
  if (low >= high) return;
  let facts = transitionMemo.get(timeZone);
  if (facts === undefined) {
    if (transitionMemo.size >= MAX_MEMO_ZONES) {
      const oldest = transitionMemo.keys().next();
      if (!oldest.done) transitionMemo.delete(oldest.value);
    }
    facts = { spans: [] };
    transitionMemo.set(timeZone, facts);
  }

  // Spans are sorted and disjoint, so those this one overlaps or touches are one run.
  let mergedLow = low;
  let mergedHigh = high;
  let mergedChanges = changes;
  const kept: KnownSpan[] = [];
  const after: KnownSpan[] = [];
  for (const span of facts.spans) {
    if (span.high < low) {
      kept.push(span);
    } else if (span.low > high) {
      after.push(span);
    } else {
      mergedLow = minimum(mergedLow, span.low);
      mergedHigh = maximum(mergedHigh, span.high);
      mergedChanges = mergeSorted(mergedChanges, span.changes);
    }
  }
  kept.push({ low: mergedLow, high: mergedHigh, changes: mergedChanges });
  kept.push(...after);

  const total = kept.reduce((sum, span) => sum + span.changes.length, 0);
  facts.spans =
    kept.length > MAX_MEMO_SPANS || total > MAX_MEMO_CHANGES
      ? [{ low, high, changes: [...changes] }]
      : kept;
}

function spanAround(
  timeZone: string,
  holds: (span: KnownSpan) => boolean,
): KnownSpan | undefined {
  return transitionMemo.get(timeZone)?.spans.find(holds);
}

function currentEpochNanoseconds(): bigint {
  return nowInstant().epochNanoseconds;
}

/**
 * TC39 `GetNamedTimeZoneNextTransition`: the first offset change strictly after `from`.
 *
 * @param timeZone a named zone
 * @param from the instant to search after (exclusive)
 * @param until optional: the last instant to search (inclusive); a later change returns null
 * @returns the change's epoch nanoseconds, or null when there is none up to `until` or none within
 *   three years of the later of `from` and the current instant
 * @throws RangeError past `MAX_SEARCH_STEPS` steps
 */
export function nextTransitionAfter(
  timeZone: string,
  from: bigint,
  until?: bigint,
): bigint | null {
  // The horizon holds with or without a limit, as it does when the polyfill answers and the
  // limit only filters its result. It is at least `from` plus the horizon span, so a limit within
  // that span is never cut by it and the clock is not read.
  const end = minimum(
    MAX_EPOCH_NANOSECONDS,
    until !== undefined &&
      until <= from + NO_FURTHER_TRANSITION_HORIZON_NANOSECONDS
      ? until
      : minimum(
          until ?? MAX_EPOCH_NANOSECONDS,
          maximum(from, currentEpochNanoseconds()) +
            NO_FURTHER_TRANSITION_HORIZON_NANOSECONDS,
        ),
  );
  if (from >= end) return null;

  let low = from;
  if (low < POLYFILL_TRANSITION_SEARCH_FLOOR) {
    const missed = missedNextTransition(timeZone, low);
    if (missed !== null) return missed <= end ? missed : null;
    if (end <= POLYFILL_TRANSITION_SEARCH_FLOOR) return null;
    low = POLYFILL_TRANSITION_SEARCH_FLOOR;
  }

  return sampledNext(timeZone, low, end);
}

/** The first change in `(low, end]`, answered from the memo where it can be, else sampled. */
function sampledNext(
  timeZone: string,
  from: bigint,
  end: bigint,
): bigint | null {
  // A cold search takes at most MAX_SEARCH_STEPS steps from `from`, so it reaches `cutoff`, and
  // throws when `end` lies past it with no change before it. The memo answers the same: what it
  // knows is never allowed to carry a search past a bound the cold search would stop at.
  const cutoff =
    from + BigInt(MAX_SEARCH_STEPS) * TRANSITION_SEARCH_STEP_NANOSECONDS;
  let low = from;
  const known = spanAround(
    timeZone,
    (span) => span.low <= low && low < span.high,
  );
  if (known !== undefined) {
    const change = known.changes.find((c) => c > low);
    if (change !== undefined) {
      if (change <= minimum(end, cutoff)) return change;
      if (end <= cutoff) return null;
      throw outOfSteps(timeZone);
    }
    if (known.high >= end) {
      if (end <= cutoff) return null;
      throw outOfSteps(timeZone);
    }
    low = known.high;
    if (low >= cutoff) throw outOfSteps(timeZone);
  }

  const searchStart = low;
  const lowOffset = offsetAt(timeZone, low);
  while (low < cutoff) {
    const high = minimum(
      minimum(low + TRANSITION_SEARCH_STEP_NANOSECONDS, end),
      cutoff,
    );
    const highOffset = offsetAt(timeZone, high);
    if (highOffset !== lowOffset) {
      const change = changeBetween(timeZone, low, high, lowOffset, highOffset);
      recordSpan(timeZone, searchStart, change, [change]);
      return change;
    }
    if (high >= end) {
      recordSpan(timeZone, searchStart, end, []);
      return null;
    }
    low = high;
  }

  throw outOfSteps(timeZone);
}

function outOfSteps(timeZone: string): RangeError {
  return new RangeError(`Transition search in ${timeZone} ran past its bound`);
}

/** The last change in `(since, start]`, scanning back from `start`; null when there is none. */
function lastChangeBack(
  timeZone: string,
  start: bigint,
  since: bigint,
): bigint | null {
  // As in `sampledNext`: a cold search runs MAX_SEARCH_STEPS steps down from `start`, and reaches
  // `since` (null) only if that takes fewer than MAX_SEARCH_STEPS of them.
  const cutoff =
    start - BigInt(MAX_SEARCH_STEPS) * TRANSITION_SEARCH_STEP_NANOSECONDS;
  const reachesSince =
    start - since <=
    BigInt(MAX_SEARCH_STEPS - 1) * TRANSITION_SEARCH_STEP_NANOSECONDS;
  let high = start;
  const known = spanAround(
    timeZone,
    (span) => span.low < start && start <= span.high,
  );
  if (known !== undefined) {
    const change = known.changes.filter((c) => c <= start).pop();
    if (change !== undefined && change > maximum(since, cutoff)) return change;
    if (change !== undefined || known.low <= since) {
      if (reachesSince) return null;
      throw outOfSteps(timeZone);
    }
    high = known.low;
  }

  const searchStart = high;
  // Read only once a step is taken: a start the memo carried to `since` or `cutoff` needs none.
  let highOffset: bigint | undefined;

  for (;;) {
    if (high <= since) {
      if (!reachesSince) throw outOfSteps(timeZone);
      recordSpan(timeZone, since, searchStart, []);
      return null;
    }
    if (high <= cutoff) throw outOfSteps(timeZone);
    highOffset ??= offsetAt(timeZone, searchStart);
    const low = maximum(
      maximum(high - TRANSITION_SEARCH_STEP_NANOSECONDS, since),
      cutoff,
    );
    const lowOffset = offsetAt(timeZone, low);
    if (lowOffset !== highOffset) {
      const change = changeBetween(timeZone, low, high, lowOffset, highOffset);
      recordSpan(timeZone, change - 1n, searchStart, [change]);
      return change;
    }
    high = low;
  }
}

/**
 * The last change before an instant more than three years past the current one. The polyfill's
 * rule: when the zone has no change between now and three years from now, there is none later, so
 * the answer is the last change before that horizon. A zone whose rules repeat has one in the
 * three years before `from`. Otherwise its future changes are a finite table (Africa/Casablanca,
 * to 2087), walked forward to its end. A change at or before `since` is not looked for.
 */
function previousTransitionFarAhead(
  timeZone: string,
  from: bigint,
  now: bigint,
  since: bigint | undefined,
): bigint | null {
  const recentStart = from - NO_FURTHER_TRANSITION_HORIZON_NANOSECONDS;
  const recent = lastChangeBack(
    timeZone,
    from - 1n,
    since === undefined ? recentStart : maximum(since, recentStart),
  );
  if (recent !== null) return recent;
  if (since !== undefined && since >= recentStart) return null;

  const horizon = now + NO_FURTHER_TRANSITION_HORIZON_NANOSECONDS;
  let last = previousTransitionBefore(timeZone, horizon, since);
  if (last === null || last < now) return last;

  for (let i = 0; i < MAX_TABLED_TRANSITIONS; i++) {
    const next = nextTransitionAfter(timeZone, last);
    if (next === null || next >= from) return last;
    last = next;
  }

  throw new RangeError(`Transition walk in ${timeZone} ran past its bound`);
}

/**
 * TC39 `GetNamedTimeZonePreviousTransition`: the last offset change strictly before `from`.
 *
 * @param timeZone a named zone
 * @param from the instant to search before (exclusive)
 * @param since optional: the search stops here (exclusive); an earlier change returns null
 * @returns the change's epoch nanoseconds, or null when there is none after `since`, or, with no
 *   `since`, none at all
 * @throws RangeError past `MAX_SEARCH_STEPS` steps or `MAX_TABLED_TRANSITIONS` tabled changes
 */
export function previousTransitionBefore(
  timeZone: string,
  from: bigint,
  since?: bigint,
): bigint | null {
  if (from <= MIN_EPOCH_NANOSECONDS) return null;

  // The horizon holds with or without a limit: see `nextTransitionAfter`.
  const now = currentEpochNanoseconds();
  if (from - 1n > now + NO_FURTHER_TRANSITION_HORIZON_NANOSECONDS) {
    return previousTransitionFarAhead(timeZone, from, now, since);
  }

  const floor = maximum(
    since ?? POLYFILL_TRANSITION_SEARCH_FLOOR,
    POLYFILL_TRANSITION_SEARCH_FLOOR,
  );
  const found =
    from - 1n > floor ? lastChangeBack(timeZone, from - 1n, floor) : null;
  if (found !== null) return found;
  if (since !== undefined && since >= POLYFILL_TRANSITION_SEARCH_FLOOR) {
    return null;
  }

  const missed = missedPreviousTransition(timeZone, from);
  return missed !== null && (since === undefined || missed > since)
    ? missed
    : null;
}
