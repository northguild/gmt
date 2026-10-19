import { Temporal } from "./temporal";
import { isValidTime } from "../plain/validate/isValidTime";
import type { Disambiguation } from "../types";
import { nextZonedBucketStart, zonedUnitStart } from "./zonedBucket";
import {
  frameEpochNanoseconds,
  frameWallClock,
  frameZoned,
  instantOfWallClock,
  type ZoneFrame,
} from "./zoneFrame";
import { zonedDateTimeFrom } from "./zonedWallClock";
import { zonedNextTransition } from "./zonedWallClockOperations";

/** One local period, `[start, end)`, as epoch nanoseconds. */
export type UnitSpan = { start: bigint; end: bigint };

/** The local unit a count `Period` is made of. */
export type CalendarUnit = "day" | "week" | "month" | "year";

/**
 * The local periods of one kind in one reference zone.
 *
 * `containing(x)` is the period `x` falls in, `start ≤ x < end`; null when that period, or the
 * one after it, cannot be represented. Results are cached, so a call that asks about the same
 * periods again (every candidate window of `dutyViolations`) resolves each boundary once.
 */
export type UnitScale = {
  basis: "operatorDay" | "calendar";
  containing: (x: bigint) => UnitSpan | null;
  /**
   * The period `periods` after the one `span` is (before it when negative), found without
   * stepping through the periods between: `undefined` where it cannot be, and the periods must be
   * walked. Null when that period cannot be represented.
   */
  jump?: (span: UnitSpan, periods: number) => UnitSpan | null | undefined;
  /** The periods `periodAfter` has walked, in order, so no walk is made twice in a call. */
  chain: PeriodChain;
};

/**
 * Periods walked one after another, each by its place in the walk: `first` and `last` are the
 * places of the earliest and latest kept.
 */
export type PeriodChain = {
  byPlace: Map<number, UnitSpan>;
  byStart: Map<bigint, number>;
  first: number;
  last: number;
};

/** A chain holding nothing yet. */
export const emptyChain = (): PeriodChain => ({
  byPlace: new Map(),
  byStart: new Map(),
  first: 0,
  last: -1,
});

/**
 * How many periods away `periodAfter` steps through the periods instead of jumping: stepping
 * through a few cached periods costs less than searching for a clock change between them.
 */
const SHORT_WALK = 64;

/**
 * How far from an instant's local date the operator-day search reaches. A day start resolves
 * at most one deleted date later (`Pacific/Apia`, 2011-12-30), and a fall-back that re-enters
 * the previous date (`America/Goose_Bay`, 2010-11-06) can put the next date's start before the
 * instant, so two dates either side of it cover every zone.
 */
const OPERATOR_DAY_REACH = 3;

/** Parse a `dayStartTime`: an ISO PlainTime string `isValidTime` accepts, or null. */
export function parseDayStartTime(value: unknown): Temporal.PlainTime | null {
  if (typeof value !== "string" || !isValidTime(value)) {
    return null;
  }

  return Temporal.PlainTime.from(value);
}

/**
 * Thrown when `"reject"` meets a wall time that matters and that the zone repeats or skips.
 * Caught by the public function, which returns its sentinel.
 */
export class WallClockRejected extends RangeError {}

/** A wall clock resolved under a policy, and whether `"reject"` refuses it. */
export type ResolvedWallClock = { at: bigint; rejected: boolean };

/**
 * The instant a local date and wall time name in a reference zone, resolved as `resolveLocal`
 * resolves it under `disambiguation`.
 *
 * - `"compatible"` reads a skipped time after the gap and a repeated one at its first pass;
 *   `"earlier"` and `"later"` take that side in both cases.
 * - Under `"reject"` the instant is the `"compatible"` one, and `rejected` says whether the zone
 *   repeats or skips that wall time, so a caller rejects only a wall time its answer uses.
 * - A stored offset (`±HH:MM:SS`) has no transition, so nothing is ever rejected there.
 *
 * @param frame the reference zone, from `zoneFrame`
 * @param date the local date
 * @param time the local wall time
 * @param disambiguation the policy for a repeated or skipped wall time
 * @returns the instant and whether it is rejected, or null when it is outside Temporal's range
 *
 * @example resolveWallClock(zoneFrame("UTC"), Temporal.PlainDate.from("1970-01-02"), Temporal.PlainTime.from("00:00"), "compatible") // { at: 86400000000000n, rejected: false }
 */
export function resolveWallClock(
  frame: ZoneFrame,
  date: Temporal.PlainDate,
  time: Temporal.PlainTime,
  disambiguation: Disambiguation,
): ResolvedWallClock | null {
  const wallClock = `${date.toString()}T${time.toString()}`;

  if (frame.shiftNanoseconds !== 0n) {
    try {
      return {
        at: instantOfWallClock(wallClock, frame).epochNanoseconds,
        rejected: false,
      };
    } catch {
      return null;
    }
  }

  const zoned = `${wallClock}[${frame.timeZone}]`;
  let at: bigint;

  try {
    at = zonedDateTimeFrom(zoned, {
      disambiguation:
        disambiguation === "reject" ? "compatible" : disambiguation,
    }).epochNanoseconds;
  } catch {
    return null;
  }

  if (disambiguation !== "reject") {
    return { at, rejected: false };
  }

  try {
    zonedDateTimeFrom(zoned, { disambiguation: "reject" });
    return { at, rejected: false };
  } catch {
    return { at, rejected: true };
  }
}

/** The local date an instant falls on in a reference zone. */
export function localDateOf(frame: ZoneFrame, x: bigint): Temporal.PlainDate {
  return frameWallClock(
    Temporal.Instant.fromEpochNanoseconds(x),
    frame,
  ).toPlainDate();
}

/** A date some days after another, or null past Temporal's date range. */
export function datePlusDays(
  date: Temporal.PlainDate,
  days: number,
): Temporal.PlainDate | null {
  try {
    return date.add({ days });
  } catch {
    return null;
  }
}

/** A sorted cache of the spans a scale has resolved, searched before any is computed again. */
function cachedScale(
  basis: UnitScale["basis"],
  resolve: (x: bigint) => UnitSpan | null,
): UnitScale {
  const spans: UnitSpan[] = [];

  const find = (x: bigint): number => {
    let low = 0;
    let high = spans.length;

    // A binary search over at most 2^32 spans.
    for (let step = 0; step < 33 && low < high; step++) {
      const middle = (low + high) >> 1;

      if ((spans[middle] as UnitSpan).end <= x) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }

    return low;
  };

  return {
    basis,
    chain: emptyChain(),
    containing: (x) => {
      const index = find(x);
      const cached = spans[index];

      if (cached !== undefined && cached.start <= x) {
        return cached;
      }

      const span = resolve(x);

      if (span !== null) {
        // The forward walk resolves each span after the last one: an append, not an insert.
        if (index === spans.length) {
          spans.push(span);
        } else {
          spans.splice(index, 0, span);
        }
      }

      return span;
    },
  };
}

/**
 * The operator-designated days of a reference zone: each starts at `time` on a local date,
 * resolved under `disambiguation` as `resolveLocal` resolves it, and runs to the next date's start.
 *
 * - Every policy maps wall times to instants without reversing them, so the starts never go
 *   backwards and the days tile the timeline. A date whose start resolves onto the next date's
 *   start (a date the zone deleted) opens no day of its own.
 * - Under `"reject"`, a day whose start or end is a repeated or skipped wall time throws
 *   `WallClockRejected`; a day bounded by ordinary wall times is answered as `"compatible"`.
 *
 * @param frame the reference zone, from `zoneFrame`
 * @param time the local wall time each day starts at
 * @param disambiguation the policy for a start time the zone repeats or skips
 * @returns the operator days
 *
 * @example operatorDayScale(zoneFrame("UTC"), Temporal.PlainTime.from("04:00"), "compatible").containing(0n) // { start: -72000000000000n, end: 14400000000000n }
 */
export function operatorDayScale(
  frame: ZoneFrame,
  time: Temporal.PlainTime,
  disambiguation: Disambiguation,
): UnitScale {
  const starts = new Map<string, ResolvedWallClock | null>();

  const startOf = (date: Temporal.PlainDate): ResolvedWallClock | null => {
    const key = date.toString();
    const known = starts.get(key);

    if (known !== undefined) {
      return known;
    }

    const start = resolveWallClock(frame, date, time, disambiguation);
    starts.set(key, start);
    return start;
  };

  return cachedScale("operatorDay", (x) => {
    const localDate = localDateOf(frame, x);

    for (let back = -1; back <= OPERATOR_DAY_REACH; back++) {
      const date = datePlusDays(localDate, -back);
      const start = date === null ? null : startOf(date);

      if (date === null || start === null) {
        return null;
      }

      if (start.at > x) {
        continue;
      }

      for (let ahead = 1; ahead <= OPERATOR_DAY_REACH + 1; ahead++) {
        const next = datePlusDays(date, ahead);
        const resolved = next === null ? null : startOf(next);

        if (next === null || resolved === null) {
          return null;
        }

        if (resolved.at > x) {
          // A deleted date's start resolves onto the next date's, and opens no day: the day ends
          // where the next date that opens one starts, which "reject" judges by that date's wall time.
          const following = datePlusDays(next, 1);
          const after = following === null ? null : startOf(following);
          const end =
            after !== null && after.at === resolved.at ? after : resolved;

          if (start.rejected || end.rejected) {
            throw new WallClockRejected(
              "a day boundary the zone repeats or skips",
            );
          }
          return { start: start.at, end: end.at };
        }
      }

      return null;
    }

    return null;
  });
}

/**
 * The local calendar days, ISO weeks (Monday first), months or years of a reference zone, as
 * `floorToZone` and `bucketRange` find them: real boundaries, never a truncated wall clock
 * resolved again.
 *
 * @param frame the reference zone, from `zoneFrame`
 * @param unit the calendar unit
 * @returns the periods
 *
 * @example calendarScale(zoneFrame("UTC"), "day").containing(1n) // { start: 0n, end: 86400000000000n }
 */
export function calendarScale(frame: ZoneFrame, unit: CalendarUnit): UnitScale {
  const scale = cachedScale("calendar", (x) => {
    try {
      const zoned = frameZoned(Temporal.Instant.fromEpochNanoseconds(x), frame);
      const start = zonedUnitStart(zoned, unit);
      const next = nextZonedBucketStart(zoned, unit);

      if (start === null || next === null) {
        return null;
      }

      return {
        start: frameEpochNanoseconds(start, frame),
        end: frameEpochNanoseconds(next, frame),
      };
    } catch {
      return null;
    }
  });
  const step = CALENDAR_JUMPS[unit];

  if (step === undefined) {
    return scale;
  }

  return {
    ...scale,
    // With no clock change between two periods, every week, month or year between them is one
    // period, so the period k after another holds the wall clock k units after its middle (days
    // from either edge, so a clock change within two days cannot move it to a neighbour). A clock
    // change can open a period of its own (Goose Bay's fall-back at 00:01 on 1 November 2009
    // reopened 31 October for a 59-minute month), so across one the periods are walked.
    jump: (span, periods) => {
      try {
        const middle = frameZoned(
          Temporal.Instant.fromEpochNanoseconds(
            span.start + (span.end - span.start) / 2n,
          ),
          frame,
        );
        const target = scale.containing(
          frameEpochNanoseconds(middle.add({ [step]: periods }), frame),
        );

        if (target === null) {
          return null;
        }

        const low = target.start < span.start ? target : span;
        const high = target.end > span.end ? target : span;
        const change = zonedNextTransition(
          frameZoned(
            Temporal.Instant.fromEpochNanoseconds(low.start - 1n),
            frame,
          ),
          high.end + frame.shiftNanoseconds,
        );

        return change === null ? target : undefined;
      } catch {
        return null;
      }
    },
  };
}

/**
 * The calendar units a scale can jump across, by the duration field that moves the wall clock by
 * one. A day cannot: a date a zone deleted has no period, so k dates on is not k days on.
 */
const CALENDAR_JUMPS: Partial<
  Record<CalendarUnit, "weeks" | "months" | "years">
> = {
  week: "weeks",
  month: "months",
  year: "years",
};

/**
 * The period `periods` after `span` in a scale (before it when negative), `span` itself for 0.
 *
 * - A few periods away, it steps through them. Further, it takes the scale's `jump` where the
 *   scale can jump there, and otherwise walks, keeping each period walked in the scale's chain,
 *   so a call that asks again, or asks for a neighbour, walks no period twice.
 * - Null when a period on the way cannot be represented.
 *
 * @param scale the periods
 * @param span a period of the scale
 * @param periods how many periods on, at most `2 × MAX_PERIOD_COUNT` either way
 * @returns the period, or null
 *
 * @example periodAfter(calendarScale(zoneFrame("UTC"), "day"), { start: 0n, end: 86400000000000n }, 1) // { start: 86400000000000n, end: 172800000000000n }
 */
export function periodAfter(
  scale: UnitScale,
  span: UnitSpan,
  periods: number,
): UnitSpan | null {
  const steps = Math.abs(periods);

  if (steps <= SHORT_WALK) {
    let current: UnitSpan | null = span;

    for (let step = 0; step < steps && current !== null; step++) {
      current = scale.containing(
        periods > 0 ? current.end : current.start - 1n,
      );
    }

    return current;
  }

  // Placing the span may start a new chain, so the chain is read after it.
  const place = placeInChain(scale, span);
  const chain = scale.chain;
  const known = chain.byPlace.get(place + periods);

  if (known !== undefined) {
    return known;
  }

  const jumped = scale.jump?.(span, periods);

  if (jumped !== undefined) {
    return jumped;
  }

  const target = place + periods;

  for (let step = 0; chain.last < target && step <= steps; step++) {
    const next = scale.containing(
      (chain.byPlace.get(chain.last) as UnitSpan).end,
    );

    if (next === null) {
      return null;
    }
    keep(chain, chain.last + 1, next);
  }

  for (let step = 0; chain.first > target && step <= steps; step++) {
    const previous = scale.containing(
      (chain.byPlace.get(chain.first) as UnitSpan).start - 1n,
    );

    if (previous === null) {
      return null;
    }
    keep(chain, chain.first - 1, previous);
  }

  return chain.byPlace.get(target) ?? null;
}

/** Keep a period in a chain at a place next to its ends. */
function keep(chain: PeriodChain, place: number, span: UnitSpan): void {
  chain.byPlace.set(place, span);
  chain.byStart.set(span.start, place);
  chain.first = Math.min(chain.first, place);
  chain.last = Math.max(chain.last, place);
}

/**
 * A period's place in the scale's chain. A period next to either end joins the chain; any other
 * starts a new one, since the periods between were never walked.
 */
function placeInChain(scale: UnitScale, span: UnitSpan): number {
  const chain = scale.chain;
  const known = chain.byStart.get(span.start);

  if (known !== undefined) {
    return known;
  }

  if (chain.last >= chain.first) {
    if ((chain.byPlace.get(chain.last) as UnitSpan).end === span.start) {
      keep(chain, chain.last + 1, span);
      return chain.last;
    }
    if ((chain.byPlace.get(chain.first) as UnitSpan).start === span.end) {
      keep(chain, chain.first - 1, span);
      return chain.first;
    }
  }

  scale.chain = emptyChain();
  keep(scale.chain, 0, span);
  return 0;
}

/**
 * The `count` periods of a scale that end with the one `anchor` falls in.
 *
 * @param scale the periods
 * @param count how many, a positive integer
 * @param anchor the instant whose period is the last
 * @returns the span from the first period's start to the last's end, or null when a period
 *   cannot be represented
 *
 * @example periodsEndingAt(calendarScale(zoneFrame("UTC"), "day"), 2, 1n) // { start: -86400000000000n, end: 86400000000000n }
 */
export function periodsEndingAt(
  scale: UnitScale,
  count: number,
  anchor: bigint,
): UnitSpan | null {
  const last = scale.containing(anchor);
  const first = last === null ? null : periodAfter(scale, last, 1 - count);

  return last === null || first === null
    ? null
    : { start: first.start, end: last.end };
}
