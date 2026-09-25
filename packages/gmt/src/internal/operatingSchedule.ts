import { Temporal } from "@js-temporal/polyfill";
import { resolveLocal } from "../instant/convert/resolveLocal";
import { isValidDate } from "../plain/validate/isValidDate";
import { isValidTime } from "../plain/validate/isValidTime";
import type { Disambiguation } from "../types";
import { isValidTimeZone } from "../zoned/validate/isValidTimeZone";
import { parseBusinessCalendar, parseHolidays } from "./businessCalendar";
import {
  coalesceIntervalNanoseconds,
  type IntervalNanoseconds,
} from "./intervalNanoseconds";
import { isObject, isOptionsArgument } from "./isObject";
import { nextZonedBucketStart, zonedUnitStart } from "./zonedBucket";

/** A `LocalWindow` validated once: canonical PlainTime strings, and whether it wraps midnight. */
export type ResolvedWindow = { from: string; to: string; wraps: boolean };

/** An `OperatingSchedule` reduced to the lookups the day walk needs. */
export type ResolvedSchedule = {
  timeZone: string;
  /** Windows by ISO weekday; index 0 is unused. */
  weekly: readonly (readonly ResolvedWindow[])[];
  holidays: ReadonlySet<string>;
  overrides: ReadonlyMap<string, readonly ResolvedWindow[]>;
};

const DISAMBIGUATIONS: readonly string[] = [
  "compatible",
  "earlier",
  "later",
  "reject",
];

const WEEKDAY_KEYS: readonly string[] = ["1", "2", "3", "4", "5", "6", "7"];

/**
 * Local dates a range may span, counted from the date its start falls on: about 27 years, the
 * same bound `bucketRange` puts on a day walk. A walk that runs out answers with the sentinel,
 * never a partial list.
 */
export const MAX_SCHEDULE_DAYS = 10_000;

/**
 * Day buckets one walk may step through: the lookback, the dates, the one date past them that
 * settles the last, and the extra bucket a fall-back into the previous date opens. The date
 * limit is the one that binds.
 */
const MAX_SCHEDULE_BUCKETS = 2 * MAX_SCHEDULE_DAYS;

/**
 * How far before the first instant of interest the walk starts, in nanoseconds (72 hours). A
 * window is at most one local day of wall time, but a resolved edge can land a whole deleted day
 * later (`Pacific/Apia` skipped 2011-12-30), so a window that started up to two days earlier can
 * still be open. Three days clears that with room to spare.
 */
const LOOKBACK_NANOSECONDS = 259_200_000_000_000n;

/** TC39 `nsMinInstant` and `nsMaxInstant`: ±10^8 days from the epoch. */
const MIN_INSTANT_NANOSECONDS = -8_640_000_000_000_000_000_000n;
const MAX_INSTANT_NANOSECONDS = 8_640_000_000_000_000_000_000n;

/**
 * Where an edge whose wall time lies past Temporal's range resolves: just outside it. Such an
 * edge has no string, so it is only ever clipped to a range or compared, never returned.
 */
const PAST_LAST_INSTANT = MAX_INSTANT_NANOSECONDS + 1n;
const BEFORE_FIRST_INSTANT = MIN_INSTANT_NANOSECONDS - 1n;

/**
 * The search horizon of `nextOpenAt`, `nextCloseAt` and `addOperatingTime` when the caller
 * gives no `within`: one calendar year in the schedule's zone.
 */
export const DEFAULT_OPERATING_HORIZON = "P1Y";

function parseWindow(value: unknown): ResolvedWindow | null {
  if (!isObject(value) || Array.isArray(value)) {
    return null;
  }

  const { from, to } = value as { from?: unknown; to?: unknown };

  if (
    typeof from !== "string" ||
    typeof to !== "string" ||
    !isValidTime(from) ||
    !isValidTime(to)
  ) {
    return null;
  }

  const fromTime = Temporal.PlainTime.from(from);
  const toTime = Temporal.PlainTime.from(to);

  return {
    from: fromTime.toString(),
    to: toTime.toString(),
    wraps: Temporal.PlainTime.compare(toTime, fromTime) <= 0,
  };
}

function parseWindows(value: unknown): ResolvedWindow[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const windows: ResolvedWindow[] = [];

  for (const candidate of value) {
    const window = parseWindow(candidate);

    if (window === null) {
      return null;
    }

    windows.push(window);
  }

  return windows;
}

/**
 * Parse `OperatingSchedule['weekly']`: an object whose own keys are ISO weekdays `"1"`–`"7"`,
 * each holding an array of `LocalWindow`s (or `undefined`, meaning closed). Any other key, or a
 * malformed window, returns `null`.
 */
export function parseWeeklyPattern(value: unknown): ResolvedWindow[][] | null {
  if (!isObject(value) || Array.isArray(value)) {
    return null;
  }

  const weekly: ResolvedWindow[][] = Array.from({ length: 8 }, () => []);
  const record = value as Record<string, unknown>;

  for (const key of Reflect.ownKeys(record)) {
    if (typeof key !== "string" || !WEEKDAY_KEYS.includes(key)) {
      return null;
    }

    if (record[key] === undefined) {
      continue;
    }

    const windows = parseWindows(record[key]);

    if (windows === null) {
      return null;
    }

    weekly[Number(key)] = windows;
  }

  return weekly;
}

/** `holidays` as a date list or a `BusinessCalendar` (only its `holidays` are read). */
function parseScheduleHolidays(value: unknown): Set<string> | null {
  if (value === undefined) {
    return new Set();
  }

  if (Array.isArray(value)) {
    return parseHolidays(value);
  }

  return parseBusinessCalendar(value)?.holidays ?? null;
}

function parseOverrides(value: unknown): Map<string, ResolvedWindow[]> | null {
  if (value === undefined) {
    return new Map();
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const overrides = new Map<string, ResolvedWindow[]>();

  for (const candidate of value) {
    if (!isObject(candidate) || Array.isArray(candidate)) {
      return null;
    }

    const { date, windows } = candidate as {
      date?: unknown;
      windows?: unknown;
    };

    if (typeof date !== "string" || !isValidDate(date)) {
      return null;
    }

    const key = Temporal.PlainDate.from(date).toString();
    const parsed = parseWindows(windows);

    // Two overrides for one date say two different things about it.
    if (parsed === null || overrides.has(key)) {
      return null;
    }

    overrides.set(key, parsed);
  }

  return overrides;
}

/** Validate an `OperatingSchedule`, or `null` when any part of it is malformed. */
export function parseOperatingSchedule(
  value: unknown,
): ResolvedSchedule | null {
  if (!isObject(value) || Array.isArray(value)) {
    return null;
  }

  const { timeZone, weekly, holidays, overrides } = value as Record<
    string,
    unknown
  >;

  if (typeof timeZone !== "string" || !isValidTimeZone(timeZone)) {
    return null;
  }

  const weeklyWindows = parseWeeklyPattern(weekly);
  const holidayDates = parseScheduleHolidays(holidays);
  const overrideWindows = parseOverrides(overrides);

  if (
    weeklyWindows === null ||
    holidayDates === null ||
    overrideWindows === null
  ) {
    return null;
  }

  return {
    timeZone,
    weekly: weeklyWindows,
    holidays: holidayDates,
    overrides: overrideWindows,
  };
}

/**
 * Read `disambiguation` from an options argument. Omitted means `"compatible"`, as in
 * `resolveLocal`; anything but the four Temporal values, or an options argument that is not an
 * object, returns `null`.
 */
export function parseScheduleDisambiguation(
  options: unknown,
): Disambiguation | null {
  if (!isOptionsArgument(options)) {
    return null;
  }

  const value = (options as { disambiguation?: unknown } | undefined)
    ?.disambiguation;

  if (value === undefined) {
    return "compatible";
  }

  return typeof value === "string" && DISAMBIGUATIONS.includes(value)
    ? (value as Disambiguation)
    : null;
}

/**
 * The last instant a search may answer with: `from` plus `within` (default one year), added in
 * the schedule's zone so `P1D` is one local day. A horizon past Temporal's last instant is that
 * instant, since nothing after it can be answered. `null` when `within` is not a non-negative
 * ISO duration.
 */
export function parseSearchHorizon(
  fromNs: bigint,
  within: unknown,
  timeZone: string,
): bigint | null {
  const text = within === undefined ? DEFAULT_OPERATING_HORIZON : within;

  if (typeof text !== "string") {
    return null;
  }

  let duration: Temporal.Duration;

  try {
    duration = Temporal.Duration.from(text);
  } catch {
    return null;
  }

  if (duration.sign < 0) {
    return null;
  }

  try {
    return Temporal.Instant.fromEpochNanoseconds(fromNs)
      .toZonedDateTimeISO(timeZone)
      .add(duration).epochNanoseconds;
  } catch (error) {
    if (error instanceof RangeError) {
      return MAX_INSTANT_NANOSECONDS;
    }
    throw error;
  }
}

/** The local date of an instant in the schedule's zone. */
function localDateOf(
  schedule: ResolvedSchedule,
  ns: bigint,
): Temporal.PlainDate {
  return Temporal.Instant.fromEpochNanoseconds(ns)
    .toZonedDateTimeISO(schedule.timeZone)
    .toPlainDate();
}

/**
 * The local date `days` after the one `fromNs` falls on, or `null` when that is past Temporal's
 * last date: no walk from `fromNs` can reach it before time runs out.
 */
function dateLimit(
  schedule: ResolvedSchedule,
  fromNs: bigint,
  days: number,
): Temporal.PlainDate | null {
  try {
    return localDateOf(schedule, fromNs).add({ days });
  } catch (error) {
    if (error instanceof RangeError) {
      return null;
    }
    throw error;
  }
}

/**
 * The day bucket the walk starts in: the one holding the instant 72 hours before `fromNs`, or
 * Temporal's first instant when that is earlier. When the bucket's own start is not
 * representable, the walk starts at that instant instead, the earliest of its date there is.
 */
function firstWalkBucket(
  schedule: ResolvedSchedule,
  fromNs: bigint,
): Temporal.ZonedDateTime | null {
  const startNs =
    fromNs - LOOKBACK_NANOSECONDS < MIN_INSTANT_NANOSECONDS
      ? MIN_INSTANT_NANOSECONDS
      : fromNs - LOOKBACK_NANOSECONDS;
  const zoned = Temporal.Instant.fromEpochNanoseconds(
    startNs,
  ).toZonedDateTimeISO(schedule.timeZone);

  try {
    return zonedUnitStart(zoned, "day");
  } catch (error) {
    if (error instanceof RangeError) {
      return zoned;
    }
    throw error;
  }
}

/** The windows that apply on `date`: an override, else nothing on a holiday, else the weekday's. */
function windowsOn(
  schedule: ResolvedSchedule,
  date: Temporal.PlainDate,
): readonly ResolvedWindow[] {
  const key = date.toString();
  const override = schedule.overrides.get(key);

  if (override !== undefined) {
    return override;
  }

  return schedule.holidays.has(key) ? [] : schedule.weekly[date.dayOfWeek];
}

/** A window whose edge did not resolve under `"reject"`: the widest span it could cover. */
type Unresolved = { start: bigint; end: bigint };

/** A resolved edge: its instant, and its UTC string (empty past Temporal's range). */
type ResolvedEdge = { ns: bigint; text: string };

/**
 * Resolve one window edge with `resolveLocal`. `local` is `null` for a wrap past Temporal's last
 * date. A wall time outside Temporal's range fails under every policy, so it resolves just
 * outside the range, on the side its date lies. `undefined` means `"reject"` refused it.
 */
function resolveEdge(
  local: string | null,
  date: Temporal.PlainDate,
  timeZone: string,
  disambiguation: Disambiguation,
): ResolvedEdge | undefined {
  if (local === null) {
    return { ns: PAST_LAST_INSTANT, text: "" };
  }

  const text = resolveLocal(local, timeZone, { disambiguation });

  if (text !== "") {
    return { ns: Temporal.Instant.from(text).epochNanoseconds, text };
  }

  if (disambiguation === "reject" && resolveLocal(local, timeZone) !== "") {
    return undefined;
  }

  return {
    ns: date.year > 0 ? PAST_LAST_INSTANT : BEFORE_FIRST_INSTANT,
    text: "",
  };
}

/**
 * Resolve one date's windows to instants with `resolveLocal`. Each edge is resolved on its own
 * under `disambiguation`; a wrapping window's `to` is read on the next date. An edge pair that
 * resolves to an empty or inverted span (a window shorter than the gap it straddles) is dropped.
 *
 * Under `"earlier"`, an edge in a gap moves back by the gap's length (TC39
 * DisambiguatePossibleEpochNanoseconds), so a date whose midnight is skipped can open before its
 * own first instant, on the previous date. No zone has jumped forward by more than a day, so a
 * window never starts before the previous date's first instant.
 *
 * Under `"reject"`, a window with an ambiguous or nonexistent edge is not guessed: it is returned
 * in `unresolved` as the widest span it could cover (its start read `"earlier"`, its end
 * `"later"`), so the caller can refuse an answer it might change and ignore it elsewhere.
 */
function resolveDateWindows(
  schedule: ResolvedSchedule,
  date: Temporal.PlainDate,
  disambiguation: Disambiguation,
): { records: IntervalNanoseconds[]; unresolved: Unresolved[] } {
  const records: IntervalNanoseconds[] = [];
  const unresolved: Unresolved[] = [];
  const { timeZone } = schedule;

  for (const window of windowsOn(schedule, date)) {
    let endDate: Temporal.PlainDate | null = date;

    if (window.wraps) {
      try {
        endDate = date.add({ days: 1 });
      } catch (error) {
        if (!(error instanceof RangeError)) {
          throw error;
        }
        endDate = null;
      }
    }

    const startLocal = `${date.toString()}T${window.from}`;
    const endLocal =
      endDate === null ? null : `${endDate.toString()}T${window.to}`;
    const start = resolveEdge(startLocal, date, timeZone, disambiguation);
    const end = resolveEdge(
      endLocal,
      endDate ?? date,
      timeZone,
      disambiguation,
    );

    if (start === undefined || end === undefined) {
      // "earlier" and "later" always resolve, so the widest span is always known.
      const earliest = resolveEdge(startLocal, date, timeZone, "earlier");
      const latest = resolveEdge(endLocal, endDate ?? date, timeZone, "later");

      unresolved.push({
        start: earliest?.ns ?? BEFORE_FIRST_INSTANT,
        end: latest?.ns ?? PAST_LAST_INSTANT,
      });
      continue;
    }

    if (start.ns < end.ns) {
      records.push({
        start: start.ns,
        end: end.ns,
        startText: start.text,
        endText: end.text,
      });
    }
  }

  return { records, unresolved };
}

/**
 * What the walk tells its caller.
 *
 * - `run` is a finished open run: sorted, disjoint, non-touching and never extended later.
 * - `day` announces that every window still to come starts at or after `bound`, and passes the
 *   runs still `pending`: sorted and disjoint, each ending at or after `bound`, so a later window
 *   may extend them but cannot add open time before `bound`. A caller can answer from them once
 *   its answer lies at or before `bound`.
 * - Returning `true` from either stops the walk; stopping from `day` hands the pending runs to
 *   `run` first.
 */
export type ScheduleVisitor = {
  run: (run: IntervalNanoseconds) => boolean;
  day: (bound: bigint, pending: readonly IntervalNanoseconds[]) => boolean;
};

/**
 * How a walk ended. `unresolvedStart` is the earliest instant a window rejected under
 * `"reject"` could open at, among those that could still be open at or after `fromNs`;
 * `undefined` when there is none. A rejected window on a date the walk did not reach starts at
 * or after the last `bound` it announced.
 */
export type ScheduleWalk = { unresolvedStart: bigint | undefined };

/**
 * Walk the schedule's local dates from a little before `fromNs`, handing the visitor each open
 * run as soon as no later window can extend it.
 *
 * - Dates come from the day buckets `floorToZone` and `bucketRange` use, so a deleted date
 *   (`Pacific/Apia`, 2011-12-30) is never visited, and a date the clock re-enters after a
 *   fall-back (`America/Goose_Bay`, 2010-11-06) is visited once.
 * - A window can start as early as the previous date's first instant (see `resolveDateWindows`),
 *   so the walk settles one date behind: once a date is resolved, the first instant of the date
 *   resolved before it is the `bound` no later window starts before.
 * - When the visitor stops the walk from `day`, or the last representable day is reached, the
 *   runs still pending are handed over too.
 * - Returns `null` when a day bucket could not be found, or the walk would resolve a date
 *   `MAX_SCHEDULE_DAYS + 1` after the one `fromNs` falls on.
 */
export function walkSchedule(
  schedule: ResolvedSchedule,
  fromNs: bigint,
  disambiguation: Disambiguation,
  visitor: ScheduleVisitor,
): ScheduleWalk | null {
  let pending: IntervalNanoseconds[] = [];
  let unresolvedStart: bigint | undefined;

  const finish = (): ScheduleWalk => ({ unresolvedStart });
  const flush = (): ScheduleWalk => {
    for (const run of pending) {
      if (visitor.run(run)) {
        break;
      }
    }
    return finish();
  };

  // One date past the span a range may cover: the date after a range's last is resolved to
  // settle it, since its windows can start before its own first instant.
  const limitDate = dateLimit(schedule, fromNs, MAX_SCHEDULE_DAYS + 1);
  let current = firstWalkBucket(schedule, fromNs);
  let lastDate: Temporal.PlainDate | null = null;
  let bound: bigint | undefined;

  for (let bucket = 0; bucket < MAX_SCHEDULE_BUCKETS; bucket++) {
    if (current === null) {
      return null;
    }

    if (bound !== undefined) {
      const settleBefore = bound;

      for (const run of pending) {
        if (run.end >= settleBefore) {
          break;
        }
        if (visitor.run(run)) {
          return finish();
        }
      }

      pending = pending.filter((run) => run.end >= settleBefore);

      if (visitor.day(settleBefore, pending)) {
        return flush();
      }
    }

    const date = current.toPlainDate();

    // A fall-back that re-enters the previous date opens a second bucket for it; its windows
    // were already resolved on the first visit.
    if (lastDate === null || Temporal.PlainDate.compare(date, lastDate) > 0) {
      if (
        limitDate !== null &&
        Temporal.PlainDate.compare(date, limitDate) >= 0
      ) {
        return null;
      }

      const resolved = resolveDateWindows(schedule, date, disambiguation);

      for (const window of resolved.unresolved) {
        if (
          window.end > fromNs &&
          (unresolvedStart === undefined || window.start < unresolvedStart)
        ) {
          unresolvedStart = window.start;
        }
      }

      pending = coalesceIntervalNanoseconds([...pending, ...resolved.records]);
      lastDate = date;
      bound = current.epochNanoseconds;
    }

    try {
      current = nextZonedBucketStart(current, "day");
    } catch (error) {
      // The next day starts past Temporal's last instant: nothing more can open.
      if (error instanceof RangeError) {
        return flush();
      }
      throw error;
    }
  }

  return null;
}

/**
 * The schedule's open runs clipped to `[startNs, endNs)`, in the range's own strings where a run
 * is clipped. `null` when the walk fails (see `walkSchedule`), or when a window rejected under
 * `"reject"` reaches into the range.
 */
export function scheduleRunsWithin(
  schedule: ResolvedSchedule,
  range: IntervalNanoseconds,
  disambiguation: Disambiguation,
): IntervalNanoseconds[] | null {
  // Refuse a range spanning more than MAX_SCHEDULE_DAYS local dates before walking it. Walking
  // thousands of dates only to return the sentinel took seconds.
  const lastInstant = range.end > range.start ? range.end - 1n : range.end;
  const limit = dateLimit(schedule, range.start, MAX_SCHEDULE_DAYS);

  if (
    limit !== null &&
    Temporal.PlainDate.compare(localDateOf(schedule, lastInstant), limit) >= 0
  ) {
    return null;
  }

  const runs: IntervalNanoseconds[] = [];

  const walked = walkSchedule(schedule, range.start, disambiguation, {
    run: (run) => {
      if (run.start >= range.end) {
        return true;
      }

      if (run.end > range.start) {
        const clipStart = run.start < range.start;
        const clipEnd = run.end > range.end;

        runs.push({
          start: clipStart ? range.start : run.start,
          end: clipEnd ? range.end : run.end,
          startText: clipStart ? range.startText : run.startText,
          endText: clipEnd ? range.endText : run.endText,
        });
      }

      return false;
    },
    day: (bound) => bound >= range.end,
  });

  if (
    walked === null ||
    (walked.unresolvedStart !== undefined && walked.unresolvedStart < range.end)
  ) {
    return null;
  }

  return runs.filter((run) => run.start < run.end);
}

/** The later of two instants. */
function later(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

/**
 * The first instant at or after `fromNs` that the schedule is open: `fromNs` itself inside an
 * open run, else the start of the next run. Answered as soon as no later window can open
 * sooner, without waiting for the run to close. `undefined` when none falls at or before
 * `horizonNs`, `null` when the walk fails or a window rejected under `"reject"` could open
 * sooner.
 */
export function firstOpenInstant(
  schedule: ResolvedSchedule,
  fromNs: bigint,
  horizonNs: bigint,
  disambiguation: Disambiguation,
): bigint | undefined | null {
  let answer: bigint | undefined;

  const walked = walkSchedule(schedule, fromNs, disambiguation, {
    run: (run) => {
      if (answer !== undefined) {
        return true;
      }
      if (run.end <= fromNs) {
        return false;
      }
      answer = later(run.start, fromNs);
      return true;
    },
    day: (bound, pending) => {
      if (bound > horizonNs) {
        return true;
      }

      const next = pending.find((run) => run.end > fromNs);

      if (next !== undefined && later(next.start, fromNs) <= bound) {
        answer = later(next.start, fromNs);
        return true;
      }

      return false;
    },
  });

  if (walked === null) {
    return null;
  }

  if (answer === undefined || answer > horizonNs) {
    return undefined;
  }

  const { unresolvedStart } = walked;

  return answer > fromNs &&
    unresolvedStart !== undefined &&
    unresolvedStart < answer
    ? null
    : answer;
}

/**
 * The first instant at or after `fromNs` that the schedule is closed: `fromNs` itself outside
 * every open run, else the end of the run holding it. A closed `fromNs` is answered as soon as
 * no later window can cover it. `undefined` when the answer falls after `horizonNs`, `null` when
 * the walk fails or a window rejected under `"reject"` could keep the schedule open past it.
 */
export function firstClosedInstant(
  schedule: ResolvedSchedule,
  fromNs: bigint,
  horizonNs: bigint,
  disambiguation: Disambiguation,
): bigint | undefined | null {
  let answer: bigint | undefined;

  const walked = walkSchedule(schedule, fromNs, disambiguation, {
    run: (run) => {
      if (answer !== undefined) {
        return true;
      }
      if (run.end <= fromNs) {
        return false;
      }
      answer = run.start <= fromNs ? run.end : fromNs;
      return true;
    },
    day: (bound, pending) => {
      if (bound > horizonNs) {
        return true;
      }

      const next = pending.find((run) => run.end > fromNs);

      // Closed at `fromNs`, and every later window starts after it.
      if (fromNs < bound && (next === undefined || next.start > fromNs)) {
        answer = fromNs;
        return true;
      }

      return false;
    },
  });

  if (walked === null) {
    return null;
  }

  const closed = answer ?? fromNs;

  if (closed > horizonNs) {
    return undefined;
  }

  const { unresolvedStart } = walked;

  return unresolvedStart !== undefined && unresolvedStart <= closed
    ? null
    : closed;
}

/**
 * The instant at which `amountNs` of open time has elapsed since `fromNs`: the earliest `X`
 * with exactly that much open time in `[fromNs, X)`. `fromNs` itself when `amountNs` is zero.
 * Answered as soon as no later window can add open time before `X`. `undefined` when `X` falls
 * after `horizonNs`, `null` when the walk fails or a window rejected under `"reject"` could add
 * open time before `X`.
 */
export function instantAfterOpenTime(
  schedule: ResolvedSchedule,
  fromNs: bigint,
  amountNs: bigint,
  horizonNs: bigint,
  disambiguation: Disambiguation,
): bigint | undefined | null {
  if (amountNs === 0n) {
    return fromNs;
  }

  let remaining = amountNs;
  let answer: bigint | undefined;

  const walked = walkSchedule(schedule, fromNs, disambiguation, {
    run: (run) => {
      if (answer !== undefined) {
        return true;
      }
      if (run.end <= fromNs) {
        return false;
      }

      const start = later(run.start, fromNs);

      if (run.end - start >= remaining) {
        answer = start + remaining;
        return true;
      }

      remaining -= run.end - start;
      return false;
    },
    day: (bound, pending) => {
      if (bound > horizonNs) {
        return true;
      }

      // Every pending run ends at or after `bound`, so only the first can hold a deadline at or
      // before it; open time before `bound` is final.
      const next = pending.find((run) => run.end > fromNs);

      if (next !== undefined) {
        const deadline = later(next.start, fromNs) + remaining;

        if (deadline <= next.end && deadline <= bound) {
          answer = deadline;
          return true;
        }
      }

      return false;
    },
  });

  if (walked === null) {
    return null;
  }

  if (answer === undefined || answer > horizonNs) {
    return undefined;
  }

  const { unresolvedStart } = walked;

  return unresolvedStart !== undefined && unresolvedStart < answer
    ? null
    : answer;
}

const NANOSECONDS_PER_UNIT = {
  hours: 3_600_000_000_000n,
  minutes: 60_000_000_000n,
  seconds: 1_000_000_000n,
  milliseconds: 1_000_000n,
  microseconds: 1_000n,
  nanoseconds: 1n,
} as const;

/**
 * An amount of open time in nanoseconds, from an ISO duration of hours and smaller units.
 * `null` for a negative duration, for any calendar unit (years, months, weeks or days — `P1D`
 * could mean 24 open hours or one working day, so it is not guessed), or invalid input.
 */
export function parseOpenTimeAmount(value: unknown): bigint | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const duration = Temporal.Duration.from(value);

    if (
      duration.sign < 0 ||
      duration.years !== 0 ||
      duration.months !== 0 ||
      duration.weeks !== 0 ||
      duration.days !== 0
    ) {
      return null;
    }

    return (
      Object.keys(NANOSECONDS_PER_UNIT) as (keyof typeof NANOSECONDS_PER_UNIT)[]
    ).reduce(
      (total, unit) =>
        total + BigInt(duration[unit]) * NANOSECONDS_PER_UNIT[unit],
      0n,
    );
  } catch {
    return null;
  }
}

/** Epoch nanoseconds as a UTC instant string ending in `Z`. */
export function instantText(nanoseconds: bigint): string {
  return Temporal.Instant.fromEpochNanoseconds(nanoseconds).toString();
}
