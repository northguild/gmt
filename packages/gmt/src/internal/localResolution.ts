import { isoFieldsOf } from "./epochDay";
import { classifyWall, type WallClassification } from "./earlierOccurrence";
import { parseInstantNanoseconds } from "./instantNanoseconds";
import { parseIntervalNanoseconds } from "./intervalNanoseconds";
import { isObject } from "./isObject";
import type { LocalMoment } from "./recurrenceExpansion";
import { Temporal } from "./temporal";
import type { ZoneFrame } from "./zoneFrame";
import { isNamedTimeZone, offsetAt } from "./zonedWallClock";
import { nextTransitionAfter } from "./zonedTransitionSearch";

const NANOSECONDS_PER_SECOND = 1_000_000_000n;
const SECONDS_PER_DAY = 86_400n;
const DAY = SECONDS_PER_DAY * NANOSECONDS_PER_SECOND;
/** No real offset reaches a day, and a transition within two days of a wall time can touch it. */
const NEAR = 2n * DAY;
/** Where a fresh cursor starts, before the first wall time it serves. */
const SEED_LEAD = 6n * DAY;
/** `nextTransitionAfter` reports "none" only within three 366-day years of its start. */
const NONE_HORIZON = 2n * 366n * DAY;

/** Most occurrences one `expandRecurrence` call may return. */
const MAX_WINDOW_COUNT = 10_000;

/**
 * How a local wall time reads in a zone: the instant each disambiguation takes and, for a repeated
 * or skipped time, the offset change between them.
 */
export type ResolvedLocal = {
  /** Whether the wall time is one instant, a repeated one or a skipped one. */
  kind: WallClassification;
  /** The instant `"earlier"` gives, in epoch nanoseconds. */
  earlier: bigint;
  /** The instant `"later"` gives, in epoch nanoseconds. */
  later: bigint;
  /** The offset change between `earlier` and `later` (`earlier < transition <= later`), or null when unique. */
  transition: bigint | null;
};

/** A window as `expandRecurrence` reads it: an interval, or the first `count` after an instant. */
export type OccurrenceWindowNanoseconds =
  | { kind: "interval"; start: bigint; end: bigint }
  | { kind: "after"; after: bigint; count: number };

/**
 * Read an `OccurrenceWindow` once.
 *
 * @param window the caller's window
 * @returns the window in epoch nanoseconds, or null when it is neither an interval with
 * `start <= end` nor `{ after, count }` with an integer `count` from 1 to 10,000
 *
 * @example readOccurrenceWindow({ after: "1970-01-01T00:00:00Z", count: 2 }) // { kind: "after", after: 0n, count: 2 }
 * @example readOccurrenceWindow({ after: "1970-01-01T00:00:00Z", count: 0 }) // null
 */
export function readOccurrenceWindow(
  window: unknown,
): OccurrenceWindowNanoseconds | null {
  if (!isObject(window)) {
    return null;
  }

  if ("after" in window) {
    const { after, count } = window as { after?: unknown; count?: unknown };
    const afterNanoseconds = parseInstantNanoseconds(after as string);

    if (
      afterNanoseconds === null ||
      typeof count !== "number" ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > MAX_WINDOW_COUNT
    ) {
      return null;
    }

    return { kind: "after", after: afterNanoseconds, count };
  }

  const interval = parseIntervalNanoseconds(window);

  return interval === null
    ? null
    : { kind: "interval", start: interval.start, end: interval.end };
}

/** A local moment read as UTC, in epoch nanoseconds. */
export function localNanoseconds(moment: LocalMoment): bigint {
  return (
    (BigInt(moment.day) * SECONDS_PER_DAY + BigInt(moment.second)) *
    NANOSECONDS_PER_SECOND
  );
}

function plainDateTimeOf(moment: LocalMoment): Temporal.PlainDateTime {
  const [year, month, day] = isoFieldsOf(moment.day);

  return new Temporal.PlainDateTime(
    year,
    month,
    day,
    Math.floor(moment.second / 3600),
    Math.floor((moment.second % 3600) / 60),
    moment.second % 60,
  );
}

/**
 * Build a function that places local moments in a zone.
 *
 * Meant for moments in ascending order, as the expansion visits them: a cursor walks the zone's
 * offset changes forward, so the cost is one offset lookup per change rather than per moment.
 * A moment more than eight days past the next change starts the cursor again near it, so a moment
 * costs a few lookups however many changes lie between it and the one before.
 * A moment that is not within two days of a change is placed with plain arithmetic; one that is
 * goes to `classifyWall` (TC39 disambiguation). A moment before the cursor starts it again, so
 * order costs speed, never correctness.
 *
 * @param frame the zone, from `zoneFrame`; a stored offset (seconds, or a fixed-offset zone) makes every moment unique
 * @returns the placing function; it throws what Temporal throws for a moment outside its range
 *
 * @example createLocalResolver({ timeZone: "UTC", shiftNanoseconds: 0n })({ day: 0, second: 0 }).earlier // 0n
 */
export function createLocalResolver(
  frame: ZoneFrame,
): (moment: LocalMoment) => ResolvedLocal {
  const { timeZone } = frame;
  const noChange = frame.shiftNanoseconds !== 0n || !isNamedTimeZone(timeZone);

  if (noChange) {
    const offset = offsetAt(timeZone, 0n) + frame.shiftNanoseconds;

    return (moment) => {
      const instant = localNanoseconds(moment) - offset;

      return {
        kind: "unique",
        earlier: instant,
        later: instant,
        transition: null,
      };
    };
  }

  const cursor = createCursor(timeZone);

  return (moment) => {
    const local = localNanoseconds(moment);

    cursor.moveTo(local);

    if (cursor.isSteady(local)) {
      const instant = local - cursor.offset();

      return {
        kind: "unique",
        earlier: instant,
        later: instant,
        transition: null,
      };
    }

    const change = cursor.isolatedChange(local);

    if (change !== null) {
      return placeAtChange(local, change);
    }

    const { kind, earliest, latest } = classifyWall(
      plainDateTimeOf(moment),
      timeZone,
    );
    const earlier = earliest.epochNanoseconds;

    return {
      kind,
      earlier,
      later: latest.epochNanoseconds,
      transition:
        kind === "unique" ? null : nextTransitionAfter(timeZone, earlier),
    };
  };
}

/** The one offset change near a wall time: its instant, and the offset before and after it. */
type OffsetChange = { transition: bigint; before: bigint; after: bigint };

/**
 * Place a wall time `local` (nanoseconds read as UTC) when `change` is the only offset change
 * that can touch it (TC39 `Disambiguate`, by arithmetic). `local - before` is a reading when it
 * falls before the change and `local - after` when it falls at or after it:
 *
 * - both: the wall time is repeated;
 * - one: it is unique;
 * - neither: it is skipped, and the readings are the ones `"earlier"` and `"later"` take across a gap.
 */
function placeAtChange(local: bigint, change: OffsetChange): ResolvedLocal {
  const { transition, before, after } = change;
  const first = local - before;
  const second = local - after;
  const hasFirst = first < transition;
  const hasSecond = second >= transition;

  if (hasFirst && hasSecond) {
    return { kind: "ambiguous", earlier: first, later: second, transition };
  }

  if (hasFirst || hasSecond) {
    const instant = hasFirst ? first : second;

    return {
      kind: "unique",
      earlier: instant,
      later: instant,
      transition: null,
    };
  }

  return { kind: "nonexistent", earlier: second, later: first, transition };
}

/** A forward walk over a named zone's offset changes. */
function createCursor(timeZone: string): {
  moveTo(local: bigint): void;
  isSteady(local: bigint): boolean;
  isolatedChange(local: bigint): OffsetChange | null;
  offset(): bigint;
} {
  let offset = 0n;
  let previous: bigint | null = null;
  let next: bigint | null = null;
  let searchedFrom = 0n;
  let validFrom: bigint | null = null;
  /** What follows `next`, read once: the change after it and the offset from it on. */
  let ahead: { of: bigint; after: bigint | null; offset: bigint } | null = null;

  const seed = (at: bigint): void => {
    offset = offsetAt(timeZone, at);
    previous = null;
    searchedFrom = at;
    next = nextTransitionAfter(timeZone, at);
    validFrom = at + NEAR;
    ahead = null;
  };

  const lookAhead = (change: bigint) => {
    if (ahead === null || ahead.of !== change) {
      ahead = {
        of: change,
        after: nextTransitionAfter(timeZone, change),
        offset: offsetAt(timeZone, change),
      };
    }

    return ahead;
  };

  return {
    moveTo(local) {
      if (
        validFrom === null ||
        local < validFrom ||
        (next === null && local > searchedFrom + NONE_HORIZON)
      ) {
        seed(local - SEED_LEAD);
      }

      while (next !== null && local > next + NEAR) {
        // Passing a change not yet read costs the two lookups that starting again does, so a moment
        // well past it starts the cursor near the moment instead of walking every change between.
        if (local > next + SEED_LEAD + NEAR && ahead?.of !== next) {
          seed(local - SEED_LEAD);
          continue;
        }

        const passed = lookAhead(next);

        previous = next;
        offset = passed.offset;
        searchedFrom = next;
        next = passed.after;
        validFrom = previous - NEAR;
      }
    },
    /** No offset change within two days either side, so `local - offset` is the one reading. */
    isSteady(local) {
      return (
        (next === null || next > local + NEAR) &&
        (previous === null || previous < local - NEAR)
      );
    },
    /**
     * The one change that can touch `local`, or null when that cannot be shown. Offsets are under
     * a day, so the readings of `local` lie within a day of it; `next` is the only change in that
     * span when it is within two days of `local`, the changes before it (`searchedFrom` is the
     * last known) are more than two days from it, `previous` is behind, and the one after it is
     * more than two days past both `next` and `local` (this does not rely on tzdb's spacing).
     */
    isolatedChange(local) {
      if (
        next === null ||
        next > local + NEAR ||
        (previous !== null && previous >= local - NEAR) ||
        next - searchedFrom <= NEAR
      ) {
        return null;
      }

      const following = lookAhead(next);

      return following.after !== null &&
        (following.after - next <= NEAR || following.after <= local + NEAR)
        ? null
        : { transition: next, before: offset, after: following.offset };
    },
    offset: () => offset,
  };
}

/**
 * Place one local moment in a zone, for a wall time that arrives out of order (an `RDATE`).
 *
 * @param frame the zone, from `zoneFrame`
 * @param moment the local moment
 * @returns how the moment reads in the zone
 *
 * @example resolveLocalMoment({ timeZone: "UTC", shiftNanoseconds: 0n }, { day: 0, second: 60 }).earlier // 60000000000n
 */
export function resolveLocalMoment(
  frame: ZoneFrame,
  moment: LocalMoment,
): ResolvedLocal {
  return createLocalResolver(frame)(moment);
}
