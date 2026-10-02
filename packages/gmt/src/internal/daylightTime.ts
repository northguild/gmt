import type { Temporal } from "@js-temporal/polyfill";
import {
  zonedNextTransition,
  zonedPreviousTransition,
} from "./zonedWallClockOperations";

/**
 * The longest a daylight period can last: a forward change and the backward change that undoes it
 * are less than 365 days apart. Daylight time is seasonal, so it recurs within every year, and
 * 365 days is the shortest year. A longer advance is a change of standard time.
 */
const DAYLIGHT_PERIOD_LIMIT_NANOSECONDS = 365n * 86_400_000_000_000n;

/**
 * Offset changes read in each direction before the walk gives up and answers `false`, the
 * sentinel: a bounded loop that runs out never returns a partial answer. Every walk here is also
 * limited to 365 days, and a year of `Africa/Casablanca` holds four changes, so no real zone
 * reaches the bound; `daylightTime.test.ts` reaches it with a made-up zone.
 */
const MAX_WALKED_CHANGES = 64;

/** One offset change: its instant, and how far the clocks moved (positive is forward). */
interface OffsetChange {
  at: bigint;
  step: number;
}

function offsetChangeAt(transition: Temporal.ZonedDateTime): OffsetChange {
  return {
    at: transition.epochNanoseconds,
    step:
      transition.offsetNanoseconds -
      transition.subtract({ nanoseconds: 1 }).offsetNanoseconds,
  };
}

/**
 * Apply one change to the list of advances not yet undone. A forward change joins the list. A
 * backward change undoes the most recent advance of the same size, if that advance is less than
 * 365 days old, and returns it; otherwise it undoes nothing.
 */
function applyChange(
  open: OffsetChange[],
  change: OffsetChange,
): OffsetChange | null {
  if (change.step > 0) {
    open.push(change);
    return null;
  }

  for (let i = open.length - 1; i >= 0; i--) {
    if (open[i].step !== -change.step) {
      continue;
    }
    if (change.at - open[i].at >= DAYLIGHT_PERIOD_LIMIT_NANOSECONDS) {
      return null;
    }
    return open.splice(i, 1)[0];
  }

  return null;
}

/** Whether `to` is less than the daylight period limit after `from`. */
function isWithinLimit(from: bigint, to: bigint): boolean {
  return to - from < DAYLIGHT_PERIOD_LIMIT_NANOSECONDS;
}

/**
 * The advances still open just before `next`: made in the 365 days before it and not yet undone.
 * An older advance cannot be undone at or after `next`. Null past `MAX_WALKED_CHANGES` changes.
 *
 * @param next the first change after the instant being judged
 * @param latest the change before `next`, already known to be within the limit
 */
function openAdvancesBefore(
  next: Temporal.ZonedDateTime,
  latest: Temporal.ZonedDateTime,
): OffsetChange[] | null {
  const changes: OffsetChange[] = [offsetChangeAt(latest)];
  let cursor = latest;

  for (let i = 0; i <= MAX_WALKED_CHANGES; i++) {
    const previous = zonedPreviousTransition(
      cursor,
      next.epochNanoseconds - DAYLIGHT_PERIOD_LIMIT_NANOSECONDS,
    );
    if (
      previous === null ||
      !isWithinLimit(previous.epochNanoseconds, next.epochNanoseconds)
    ) {
      const open: OffsetChange[] = [];
      for (const change of changes) {
        applyChange(open, change);
      }
      return open;
    }
    changes.unshift(offsetChangeAt(previous));
    cursor = previous;
  }

  return null;
}

/**
 * Whether a change from `next` onwards undoes one of the `open` advances made at or before `at`.
 * It has to come less than 365 days after `at`, since the advance is no later than `at`.
 */
function isUndoneFrom(
  next: Temporal.ZonedDateTime,
  open: OffsetChange[],
  at: bigint,
): boolean {
  let cursor: Temporal.ZonedDateTime | null = next;

  for (let i = 0; i <= MAX_WALKED_CHANGES; i++) {
    if (cursor === null || !isWithinLimit(at, cursor.epochNanoseconds)) {
      return false;
    }

    const undone = applyChange(open, offsetChangeAt(cursor));
    if (undone !== null && undone.at <= at) {
      return true;
    }

    cursor = zonedNextTransition(
      cursor,
      at + DAYLIGHT_PERIOD_LIMIT_NANOSECONDS,
    );
  }

  return false;
}

/**
 * Whether an instant is in daylight saving time, read from the zone's offset changes alone.
 *
 * The rule: daylight time runs from a forward change of the clocks to the backward change that
 * undoes it. A backward change undoes the most recent forward change of the same size that is not
 * yet undone, and only if it comes less than 365 days after it. An instant is in daylight time when
 * it is at or after such a forward change and before the backward change paired with it.
 *
 * A forward change that is never undone, or undone a year or more later, is a change of standard
 * time (`Europe/Istanbul` 2016, `Europe/Moscow` 2011 to 2014), as is any backward change with no
 * forward change to undo (`Asia/Almaty` 2024).
 *
 * This is GMT's own definition, not the tz database's daylight flag, which no JavaScript API
 * exposes and offsets do not determine.
 *
 * Cost: one transition lookup forward, then one back, and more only outside the ordinary summer
 * case. A paired change is less than 365 days away, so every lookup is given that limit and reads
 * no further: with GMT's own search (temporalCompat D13) at most 74 offset samples and 51 reads to
 * pin a change, for any zone and any instant.
 *
 * @param zoned the instant, in the zone to read
 * @returns true in daylight time, false in standard time or when the walk exceeds its bound
 */
export function isInDaylightTime(zoned: Temporal.ZonedDateTime): boolean {
  const at = zoned.epochNanoseconds;

  // Daylight time ends with a clock change. No change ahead, or none within the limit: standard.
  const next = zonedNextTransition(
    zoned,
    at + DAYLIGHT_PERIOD_LIMIT_NANOSECONDS,
  );
  if (next === null || !isWithinLimit(at, next.epochNanoseconds)) {
    return false;
  }

  // It begins with one too, and no change in the 365 days before `next` leaves nothing to undo.
  const latest = zonedPreviousTransition(
    next,
    next.epochNanoseconds - DAYLIGHT_PERIOD_LIMIT_NANOSECONDS,
  );
  if (
    latest === null ||
    !isWithinLimit(latest.epochNanoseconds, next.epochNanoseconds)
  ) {
    return false;
  }

  // The ordinary summer: the clocks last went forward, and next go back by as much. The latest
  // advance is the most recent one open, so `next` undoes it whatever came before.
  const latestStep = offsetChangeAt(latest).step;
  const nextStep = next.offsetNanoseconds - zoned.offsetNanoseconds;
  if (latestStep > 0 && nextStep === -latestStep) {
    return true;
  }

  const open = openAdvancesBefore(next, latest);
  if (open === null || open.length === 0) {
    return false;
  }

  return isUndoneFrom(next, open, at);
}

/**
 * Whether a zone observes daylight saving time as of an instant: the instant is in daylight time,
 * or a daylight period begins within the 365 days after it. Same rule as `isInDaylightTime`.
 *
 * @param zoned the instant to judge from, in the zone to read
 * @returns true when the zone observes daylight time then, false otherwise or past the walk bound
 */
export function observesDaylightTime(zoned: Temporal.ZonedDateTime): boolean {
  if (isInDaylightTime(zoned)) {
    return true;
  }

  let cursor = zoned;
  for (let i = 0; i <= MAX_WALKED_CHANGES; i++) {
    const next = zonedNextTransition(
      cursor,
      zoned.epochNanoseconds + DAYLIGHT_PERIOD_LIMIT_NANOSECONDS,
    );
    if (
      next === null ||
      next.epochNanoseconds - zoned.epochNanoseconds >=
        DAYLIGHT_PERIOD_LIMIT_NANOSECONDS
    ) {
      return false;
    }
    if (isInDaylightTime(next)) {
      return true;
    }
    cursor = next;
  }

  return false;
}
