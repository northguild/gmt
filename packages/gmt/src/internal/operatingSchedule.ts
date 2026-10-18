import { Temporal } from "./temporal";
import { resolveLocal } from "../instant/convert/resolveLocal";
import { isValidDate } from "../plain/validate/isValidDate";
import { isValidTime } from "../plain/validate/isValidTime";
import type { Disambiguation } from "../types";
import { parseBusinessCalendar, parseHolidays } from "./businessCalendar";
import {
  epochDayOfDate,
  hasEpochDay,
  ISO_WEEKDAYS,
  isoWeekdayOf,
  lowerBound,
} from "./epochDay";
import {
  coalesceIntervalNanoseconds,
  type IntervalNanoseconds,
} from "./intervalNanoseconds";
import {
  MAX_EPOCH_NANOSECONDS,
  MIN_EPOCH_NANOSECONDS,
} from "./epochNanoseconds";
import { isObject, isOptionsArgument } from "./isObject";
import { NANOSECONDS_PER_DAY } from "./foreignEpochs";
import {
  ensureTimeline,
  offsetOf,
  offsetTimeline,
  type OffsetTimeline,
  resolveWallNs,
  startOfDayNs,
} from "./offsetTimeline";
import { nextZonedBucketStart, zonedUnitStart } from "./zonedBucket";
import {
  frameEpochNanoseconds,
  frameWallClock,
  frameZoned,
  type ZoneFrame,
  zoneFrame,
} from "./zoneFrame";

/**
 * A `LocalWindow` validated once: canonical PlainTime strings, the same times in nanoseconds
 * since local midnight, and whether it wraps midnight.
 */
export type ResolvedWindow = {
  from: string;
  to: string;
  fromNs: bigint;
  toNs: bigint;
  wraps: boolean;
};

/** An `OperatingSchedule` reduced to the lookups the day walk needs. */
export type ResolvedSchedule = {
  /** The zone as the caller wrote it: a time zone identifier or a stored UTC offset. */
  timeZone: string;
  /** How local time is read in that zone (`zoneFrame`). */
  frame: ZoneFrame;
  /** Windows by ISO weekday; index 0 is unused. */
  weekly: readonly (readonly ResolvedWindow[])[];
  /** Holiday epoch days, sorted ascending; never mutated. */
  holidays: Readonly<Int32Array>;
  /** Override windows by epoch day (days since 1970-01-01). */
  overrides: ReadonlyMap<number, readonly ResolvedWindow[]>;
  /** Epoch days with a holiday or an override, sorted ascending, no repeats. */
  specials: Readonly<Int32Array>;
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
const MAX_SCHEDULE_DAYS = 10_000;

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

/**
 * Where an edge whose wall time lies past Temporal's range resolves: just outside it. Such an
 * edge has no string, so it is only ever clipped to a range or compared, never returned.
 */
const PAST_LAST_INSTANT = MAX_EPOCH_NANOSECONDS + 1n;
const BEFORE_FIRST_INSTANT = MIN_EPOCH_NANOSECONDS - 1n;

/**
 * The search horizon of `nextOpenAt`, `nextCloseAt` and `addOperatingTime` when the caller
 * gives no `within`: one calendar year in the schedule's zone.
 */
const DEFAULT_OPERATING_HORIZON = "P1Y";

/** Nanoseconds from midnight to a wall-clock time. */
function timeOfDayNanoseconds(time: Temporal.PlainTime): bigint {
  return BigInt(new Temporal.PlainTime().until(time).total("nanoseconds"));
}

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
    fromNs: timeOfDayNanoseconds(fromTime),
    toNs: timeOfDayNanoseconds(toTime),
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
 * Parse `OperatingSchedule['weekly']`: an object keyed by ISO weekday `"1"`–`"7"`, each holding an
 * array of `LocalWindow`s (or `undefined`, meaning closed). Each weekday is read with an ordinary
 * property get, as Temporal's `Get` reads a field list, so a non-enumerable or inherited weekday
 * applies. Any other own enumerable key, string or symbol, or a malformed window, returns `null`;
 * a non-enumerable one is not an entry, as `Object.assign` and spread do not copy it, so a
 * function carrying the weekdays is read without its built-in `length` and `name`.
 */
export function parseWeeklyPattern(value: unknown): ResolvedWindow[][] | null {
  if (!isObject(value) || Array.isArray(value)) {
    return null;
  }

  const weekly: ResolvedWindow[][] = Array.from({ length: 8 }, () => []);
  const record = value as Record<PropertyKey, unknown>;

  for (const key of Reflect.ownKeys(record)) {
    if (
      (typeof key !== "string" || !WEEKDAY_KEYS.includes(key)) &&
      Object.prototype.propertyIsEnumerable.call(record, key)
    ) {
      return null;
    }
  }

  for (const key of WEEKDAY_KEYS) {
    const day = record[key];

    if (day === undefined) {
      continue;
    }

    const windows = parseWindows(day);

    if (windows === null) {
      return null;
    }

    weekly[Number(key)] = windows;
  }

  return weekly;
}

/** `holidays` as a date list or a `BusinessCalendar` (only its `holidays` are read). */
function parseScheduleHolidays(value: unknown): Int32Array | null {
  if (value === undefined) {
    return new Int32Array(0);
  }

  if (Array.isArray(value)) {
    return parseHolidays(value);
  }

  return parseBusinessCalendar(value)?.holidays ?? null;
}

function parseOverrides(value: unknown): Map<number, ResolvedWindow[]> | null {
  if (value === undefined) {
    return new Map();
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const overrides = new Map<number, ResolvedWindow[]>();

  for (const candidate of value) {
    const entry = parseOverride(candidate);

    // Two overrides for one date say two different things about it.
    if (entry === null || overrides.has(entry[0])) {
      return null;
    }

    overrides.set(entry[0], entry[1]);
  }

  return overrides;
}

/** One override as its epoch day and windows, or `null` when it is malformed. */
function parseOverride(candidate: unknown): [number, ResolvedWindow[]] | null {
  if (!isObject(candidate) || Array.isArray(candidate)) {
    return null;
  }

  const { date, windows } = candidate as { date?: unknown; windows?: unknown };

  if (typeof date !== "string" || !isValidDate(date)) {
    return null;
  }

  // `isValidDate` accepts only the ISO calendar, so the date has an epoch day.
  const key = epochDayOfDate(Temporal.PlainDate.from(date));
  const parsed = parseWindows(windows);

  return parsed === null ? null : [key, parsed];
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

  const frame = zoneFrame(timeZone);

  if (typeof timeZone !== "string" || frame === null) {
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
    frame,
    weekly: weeklyWindows,
    holidays: holidayDates,
    overrides: overrideWindows,
    specials: specialDays(holidayDates, overrideWindows),
  };
}

/** The sorted union of the holiday days and the override days. */
function specialDays(
  holidays: Readonly<Int32Array>,
  overrides: ReadonlyMap<number, unknown>,
): Int32Array {
  const days = new Set<number>(holidays);

  for (const day of overrides.keys()) {
    days.add(day);
  }

  return Int32Array.from(days).sort();
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
 * the schedule's zone so `P1D` is one local day. It is clamped to the search cap: the last instant
 * before the local date `MAX_SCHEDULE_DAYS + 1` after the one `from` falls on, so a search answers
 * anywhere on the 10,000th date and nowhere after it. A horizon past Temporal's last instant is
 * that instant, since nothing after it can be answered. `null` when `within` is not a
 * non-negative ISO duration.
 */
export function parseSearchHorizon(
  fromNs: bigint,
  within: unknown,
  frame: ZoneFrame,
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

  const from = frameZoned(Temporal.Instant.fromEpochNanoseconds(fromNs), frame);
  const horizon = clampedToRange(() =>
    frameEpochNanoseconds(from.add(duration), frame),
  );
  const cap = clampedToRange(
    () =>
      frameEpochNanoseconds(
        from
          .toPlainDate()
          .add({ days: MAX_SCHEDULE_DAYS + 1 })
          .toZonedDateTime(frame.timeZone),
        frame,
      ) - 1n,
  );

  return horizon < cap ? horizon : cap;
}

/** An instant computed by `instant`, or Temporal's last instant when it lies past the range. */
function clampedToRange(instant: () => bigint): bigint {
  try {
    const nanoseconds = instant();

    // At a seconds offset west of UTC the instant is later than the stand-in it was computed
    // on (`frameZoned`), so it can pass the last instant without Temporal throwing.
    return nanoseconds > MAX_EPOCH_NANOSECONDS
      ? MAX_EPOCH_NANOSECONDS
      : nanoseconds;
  } catch (error) {
    if (error instanceof RangeError) {
      return MAX_EPOCH_NANOSECONDS;
    }
    throw error;
  }
}

/** The local date of an instant in the schedule's zone. */
function localDateOf(
  schedule: ResolvedSchedule,
  ns: bigint,
): Temporal.PlainDate {
  return frameWallClock(
    Temporal.Instant.fromEpochNanoseconds(ns),
    schedule.frame,
  ).toPlainDate();
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
 * the earliest instant the schedule's frame can place when that is earlier. When the bucket's own
 * start is not representable, the walk starts at that instant instead, the earliest of its date
 * there is.
 *
 * The earliest instant is Temporal's first, except at an offset with seconds west of UTC: its
 * stand-in sits the offset's seconds before the instant (`frameZoned`), so the first instant it
 * can place is that many seconds after Temporal's first. A walk from before it throws
 * `RangeError`, the caller's sentinel, rather than start after its own instant.
 *
 * `atRangeStart` is true when the walk starts at that earliest instant. No day bucket lies
 * before it, so the windows of the local date before the bucket's own are not reached by walking
 * back: the walk carries them in (`resolveWindowsBefore`).
 */
function firstWalkBucket(
  schedule: ResolvedSchedule,
  fromNs: bigint,
): { bucket: Temporal.ZonedDateTime | null; atRangeStart: boolean } {
  const shift = schedule.frame.shiftNanoseconds;
  const earliestNs =
    shift < 0n ? MIN_EPOCH_NANOSECONDS - shift : MIN_EPOCH_NANOSECONDS;

  if (fromNs < earliestNs) {
    throw new RangeError("the instant is before the first the frame can place");
  }

  const atRangeStart = fromNs - LOOKBACK_NANOSECONDS <= earliestNs;
  const startNs = atRangeStart ? earliestNs : fromNs - LOOKBACK_NANOSECONDS;
  const zoned = frameZoned(
    Temporal.Instant.fromEpochNanoseconds(startNs),
    schedule.frame,
  );

  try {
    return { bucket: zonedUnitStart(zoned, "day"), atRangeStart };
  } catch (error) {
    if (error instanceof RangeError) {
      return { bucket: zoned, atRangeStart };
    }
    throw error;
  }
}

/** The windows that apply on an epoch day: an override, else nothing on a holiday, else the weekday's. */
function windowsOnDay(
  schedule: ResolvedSchedule,
  epochDay: number,
): readonly ResolvedWindow[] {
  const override = schedule.overrides.get(epochDay);

  if (override !== undefined) {
    return override;
  }

  return hasEpochDay(schedule.holidays, epochDay)
    ? []
    : schedule.weekly[isoWeekdayOf(epochDay)];
}

/** The windows that apply on `date`. */
function windowsOn(
  schedule: ResolvedSchedule,
  date: Temporal.PlainDate,
): readonly ResolvedWindow[] {
  return windowsOnDay(schedule, epochDayOfDate(date));
}

/** A window whose edge did not resolve under `"reject"`: the widest span it could cover. */
type Unresolved = { start: bigint; end: bigint };

/** A resolved edge: its instant, and its UTC string (empty past Temporal's range). */
type ResolvedEdge = { ns: bigint; text: string };

/**
 * Where a window edge lies: a wall time on a local date, or one of the two instants just outside
 * Temporal's range, for an edge on a date Temporal cannot hold.
 */
type WindowEdge = { date: Temporal.PlainDate; time: string } | bigint;

/**
 * Resolve one window edge with `resolveLocal`. An edge on a date Temporal cannot hold is already
 * outside the range. A wall time outside Temporal's range fails under every policy, so it
 * resolves just outside the range, on the side its date lies. `undefined` means `"reject"`
 * refused it.
 */
function resolveEdge(
  edge: WindowEdge,
  timeZone: string,
  disambiguation: Disambiguation,
): ResolvedEdge | undefined {
  if (typeof edge === "bigint") {
    return { ns: edge, text: "" };
  }

  const local = `${edge.date.toString()}T${edge.time}`;
  const text = resolveLocal(local, timeZone, { disambiguation });

  if (text !== "") {
    return { ns: Temporal.Instant.from(text).epochNanoseconds, text };
  }

  if (disambiguation === "reject" && resolveLocal(local, timeZone) !== "") {
    return undefined;
  }

  return {
    ns: edge.date.year > 0 ? PAST_LAST_INSTANT : BEFORE_FIRST_INSTANT,
    text: "",
  };
}

/** The local date after `date`, or `null` past Temporal's last date. */
function dateAfter(date: Temporal.PlainDate): Temporal.PlainDate | null {
  try {
    return date.add({ days: 1 });
  } catch (error) {
    if (error instanceof RangeError) {
      return null;
    }
    throw error;
  }
}

/** The local date before `date`, or `null` before Temporal's first date. */
function dateBefore(date: Temporal.PlainDate): Temporal.PlainDate | null {
  try {
    return date.subtract({ days: 1 });
  } catch (error) {
    if (error instanceof RangeError) {
      return null;
    }
    throw error;
  }
}

/** The windows of one local date, resolved to instants, and those `"reject"` refused. */
type ResolvedWindows = {
  records: IntervalNanoseconds[];
  unresolved: Unresolved[];
};

/** The widest span a window with an unresolved edge could cover: its start `"earlier"`, its end `"later"`. */
function widestSpan(
  startEdge: WindowEdge,
  endEdge: WindowEdge,
  timeZone: string,
): Unresolved {
  // "earlier" and "later" always resolve, so the widest span is always known.
  return {
    start:
      resolveEdge(startEdge, timeZone, "earlier")?.ns ?? BEFORE_FIRST_INSTANT,
    end: resolveEdge(endEdge, timeZone, "later")?.ns ?? PAST_LAST_INSTANT,
  };
}

/** Where a window ends: its `to` on its own date, or on the next if it wraps midnight. */
function windowEndEdge(
  window: ResolvedWindow,
  date: Temporal.PlainDate | null,
  next: Temporal.PlainDate | null,
): WindowEdge {
  const endDate = window.wraps ? next : date;

  if (endDate !== null) {
    return { date: endDate, time: window.to };
  }

  return window.wraps ? PAST_LAST_INSTANT : BEFORE_FIRST_INSTANT;
}

/**
 * Resolve the windows of one local date to instants with `resolveLocal`. Each edge is resolved on
 * its own under `disambiguation`; a wrapping window's `to` is read on the next date. An edge pair
 * that resolves to an empty or inverted span (a window shorter than the gap it straddles) is
 * dropped.
 *
 * `date` is `null` for the date before Temporal's first, and `next` is `null` for the date after
 * its last. A window is a rule about the local clock, so it still holds on the side of it that
 * Temporal can reach: an edge on a date Temporal cannot hold lies just outside the range.
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
  windows: readonly ResolvedWindow[],
  date: Temporal.PlainDate | null,
  next: Temporal.PlainDate | null,
  disambiguation: Disambiguation,
): ResolvedWindows {
  const records: IntervalNanoseconds[] = [];
  const unresolved: Unresolved[] = [];
  const { timeZone } = schedule;

  for (const window of windows) {
    const startEdge: WindowEdge =
      date === null ? BEFORE_FIRST_INSTANT : { date, time: window.from };
    const endEdge = windowEndEdge(window, date, next);
    const start = resolveEdge(startEdge, timeZone, disambiguation);
    const end = resolveEdge(endEdge, timeZone, disambiguation);

    if (start === undefined || end === undefined) {
      unresolved.push(widestSpan(startEdge, endEdge, timeZone));
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
 * Resolve the windows of the local date before `date`, the first date of a walk that starts at
 * the earliest instant its frame can place.
 *
 * A window that opened on that date and wraps past midnight is still open on `date`, although
 * the instant it opened at is before the range. The previous date follows its own override or
 * holiday like any other. West of UTC the first date is Temporal's first, `-271821-04-19`, and
 * the date before it cannot be held or named: no override or holiday can be written for it, so
 * the weekly pattern applies, by the weekday before `date`'s.
 */
function resolveWindowsBefore(
  schedule: ResolvedSchedule,
  date: Temporal.PlainDate,
  disambiguation: Disambiguation,
): ResolvedWindows {
  const previous = dateBefore(date);
  const windows =
    previous === null
      ? schedule.weekly[date.dayOfWeek === 1 ? 7 : date.dayOfWeek - 1]
      : windowsOn(schedule, previous);

  return resolveDateWindows(schedule, windows, previous, date, disambiguation);
}

/**
 * Resolve the windows a walk gains on reaching `date`: the date's own and, for the first date of
 * a walk from the start of the range (`carryIn`), those of the date before it.
 */
function resolveVisit(
  schedule: ResolvedSchedule,
  date: Temporal.PlainDate,
  carryIn: boolean,
  disambiguation: Disambiguation,
): ResolvedWindows {
  const own = resolveDateWindows(
    schedule,
    windowsOn(schedule, date),
    date,
    dateAfter(date),
    disambiguation,
  );

  if (!carryIn) {
    return own;
  }

  const before = resolveWindowsBefore(schedule, date, disambiguation);

  return {
    records: [...before.records, ...own.records],
    unresolved: [...before.unresolved, ...own.unresolved],
  };
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

/** The state a walk shares between the two ways of reaching dates: pending runs and the bound. */
function startWalk(fromNs: bigint, visitor: ScheduleVisitor) {
  let pending: IntervalNanoseconds[] = [];
  let unresolvedStart: bigint | undefined;
  let bound: bigint | undefined;

  const finish = (): ScheduleWalk => ({ unresolvedStart });
  const flush = (): ScheduleWalk => {
    for (const run of pending) {
      if (visitor.run(run)) {
        break;
      }
    }
    return finish();
  };

  return {
    flush,
    /**
     * Hand the visitor the runs no later window can extend, and announce the bound. Returns the
     * walk's result when the visitor stops it, else `undefined`.
     */
    settle(): ScheduleWalk | undefined {
      if (bound === undefined) {
        return undefined;
      }

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

      return visitor.day(settleBefore, pending) ? flush() : undefined;
    },
    /** Take a date's windows; `start` is the first instant of the date. */
    add(resolved: ResolvedWindows, start: bigint): void {
      for (const window of resolved.unresolved) {
        if (
          window.end > fromNs &&
          (unresolvedStart === undefined || window.start < unresolvedStart)
        ) {
          unresolvedStart = window.start;
        }
      }

      pending = coalesceIntervalNanoseconds([...pending, ...resolved.records]);
      bound = start;
    },
  };
}

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
 * - A walk from the start of Temporal's range also resolves the date before its first, whose
 *   wrapping windows are still open when the range begins (`resolveWindowsBefore`).
 * - When the visitor stops the walk from `day`, or the last representable day is reached, the
 *   runs still pending are handed over too.
 * - Returns `null` when a day bucket could not be found, or the walk would resolve a date
 *   `MAX_SCHEDULE_DAYS + 2` after the one `fromNs` falls on. Neither use reaches that: a range
 *   is refused up front past `MAX_SCHEDULE_DAYS` dates, and a search's horizon ends with the
 *   `MAX_SCHEDULE_DAYS`th date, so its walk stops by the horizon one date later.
 */
function walkSchedule(
  schedule: ResolvedSchedule,
  fromNs: bigint,
  disambiguation: Disambiguation,
  visitor: ScheduleVisitor,
  timeline?: OffsetTimeline,
): ScheduleWalk | null {
  return walkNearsLimits(fromNs)
    ? walkScheduleByBuckets(schedule, fromNs, disambiguation, visitor)
    : walkScheduleByDays(schedule, fromNs, disambiguation, visitor, timeline);
}

/**
 * `walkSchedule` date by date through Temporal, for a walk that could come near Temporal's limits,
 * where every date, bucket and wall time keeps the range rules (`resolveEdge`).
 */
function walkScheduleByBuckets(
  schedule: ResolvedSchedule,
  fromNs: bigint,
  disambiguation: Disambiguation,
  visitor: ScheduleVisitor,
): ScheduleWalk | null {
  const walk = startWalk(fromNs, visitor);

  // The span a range or search may cover, plus the date after its last, which is resolved to
  // settle it because its windows can start before its own first instant.
  const limitDate = dateLimit(schedule, fromNs, MAX_SCHEDULE_DAYS + 2);
  const first = firstWalkBucket(schedule, fromNs);
  let current = first.bucket;
  // True until the first date is resolved, for a walk from the start of the range.
  let carryIn = first.atRangeStart;
  let lastDate: Temporal.PlainDate | null = null;

  for (let bucket = 0; bucket < MAX_SCHEDULE_BUCKETS; bucket++) {
    if (current === null) {
      return null;
    }

    const stopped = walk.settle();

    if (stopped !== undefined) {
      return stopped;
    }

    const date = current.toPlainDate();

    // A fall-back that re-enters the previous date opens a second bucket for it; its windows
    // were already resolved on the first visit.
    if (lastDate === null || Temporal.PlainDate.compare(date, lastDate) > 0) {
      if (isFromDate(date, limitDate)) {
        return null;
      }

      const resolved = resolveVisit(schedule, date, carryIn, disambiguation);
      carryIn = false;

      lastDate = date;
      walk.add(resolved, frameEpochNanoseconds(current, schedule.frame));
    }

    const following = nextDayBucket(current);

    // The next day starts past Temporal's last instant: nothing more can open.
    if (following === undefined) {
      return walk.flush();
    }

    current = following;
  }

  return null;
}

/** True when `date` is `limit` or later; never when there is no limit. */
function isFromDate(
  date: Temporal.PlainDate,
  limit: Temporal.PlainDate | null,
): boolean {
  return limit !== null && Temporal.PlainDate.compare(date, limit) >= 0;
}

/** The bucket of the next day, or `undefined` when it starts past Temporal's last instant. */
function nextDayBucket(current: Temporal.ZonedDateTime) {
  try {
    return nextZonedBucketStart(current, "day");
  } catch (error) {
    if (error instanceof RangeError) {
      return undefined;
    }
    throw error;
  }
}

/**
 * Walk dates as epoch days read from the offset timeline, without a `ZonedDateTime` per date.
 * Same contract as `walkScheduleByBuckets`, for a walk that stays clear of Temporal's limits.
 * `shared` is a timeline a caller already built that reaches at least nine days before `fromNs`,
 * so pieces of one range read the zone's offset changes once.
 * Dates ascend and are visited once: a date whose first instant is the next date's (a deleted
 * date, `Pacific/Apia` 2011-12-30) is skipped, and a re-entered date (`America/Goose_Bay`
 * 2010-11-06) is one date.
 */
function walkScheduleByDays(
  schedule: ResolvedSchedule,
  fromNs: bigint,
  disambiguation: Disambiguation,
  visitor: ScheduleVisitor,
  shared?: OffsetTimeline,
): ScheduleWalk | null {
  const walk = startWalk(fromNs, visitor);
  const startNs = fromNs - LOOKBACK_NANOSECONDS;
  const timeline =
    shared ??
    offsetTimeline(
      schedule.frame,
      startNs - 6n * NANOSECONDS_PER_DAY,
      startNs + 14n * NANOSECONDS_PER_DAY,
    );
  const limitDay = localDayOf(timeline, fromNs) + MAX_SCHEDULE_DAYS + 2;
  let day = localDayOf(timeline, startNs);

  for (let count = 0; count < MAX_SCHEDULE_BUCKETS; count++, day++) {
    ensureTimeline(timeline, BigInt(day + 6) * NANOSECONDS_PER_DAY);

    const start = startOfDayNs(timeline, day);

    if (start === startOfDayNs(timeline, day + 1)) {
      continue;
    }

    const stopped = walk.settle();

    if (stopped !== undefined) {
      return stopped;
    }

    if (day >= limitDay) {
      return null;
    }

    walk.add(
      resolveDayWindows(
        windowsOnDay(schedule, day),
        timeline,
        day,
        disambiguation,
      ),
      start,
    );
  }

  return null;
}

/** The local epoch day `ns` falls on in the timeline's frame. */
function localDayOf(timeline: OffsetTimeline, ns: bigint): number {
  return Number(floorDivide(ns + offsetOf(timeline, ns), NANOSECONDS_PER_DAY));
}

/** `resolveDateWindows` for a date well inside Temporal's range, read from the timeline. */
function resolveDayWindows(
  windows: readonly ResolvedWindow[],
  timeline: OffsetTimeline,
  day: number,
  disambiguation: Disambiguation,
): ResolvedWindows {
  const records: IntervalNanoseconds[] = [];
  const unresolved: Unresolved[] = [];
  const midnight = BigInt(day) * NANOSECONDS_PER_DAY;

  for (const window of windows) {
    const startWall = midnight + window.fromNs;
    const endWall =
      (window.wraps ? midnight + NANOSECONDS_PER_DAY : midnight) + window.toNs;
    const start = resolveWallNs(timeline, startWall, disambiguation);
    const end = resolveWallNs(timeline, endWall, disambiguation);

    if (start === undefined || end === undefined) {
      unresolved.push({
        start:
          resolveWallNs(timeline, startWall, "earlier") ?? BEFORE_FIRST_INSTANT,
        end: resolveWallNs(timeline, endWall, "later") ?? PAST_LAST_INSTANT,
      });
    } else if (start < end) {
      // The text of an edge is written when a run is returned (`runText`).
      records.push({ start, end, startText: "", endText: "" });
    }
  }

  return { records, unresolved };
}

/**
 * Days either side of Temporal's range that the closed forms and the date walk keep clear of;
 * a walk that could come nearer takes the date-by-date path, which reads the limits itself.
 */
const LIMIT_MARGIN = 30n * NANOSECONDS_PER_DAY;

/** True when a walk from `fromNs` could reach within `LIMIT_MARGIN` of Temporal's range. */
function walkNearsLimits(fromNs: bigint): boolean {
  return (
    fromNs - LOOKBACK_NANOSECONDS - LIMIT_MARGIN < MIN_EPOCH_NANOSECONDS ||
    fromNs +
      BigInt(MAX_SCHEDULE_DAYS + 3) * NANOSECONDS_PER_DAY +
      LIMIT_MARGIN >
      MAX_EPOCH_NANOSECONDS
  );
}

/**
 * True when a range spans more than MAX_SCHEDULE_DAYS local dates: it is refused before walking.
 * Walking thousands of dates only to return the sentinel took seconds.
 */
function spansTooManyDates(
  schedule: ResolvedSchedule,
  range: IntervalNanoseconds,
): boolean {
  const lastInstant = range.end > range.start ? range.end - 1n : range.end;
  const limit = dateLimit(schedule, range.start, MAX_SCHEDULE_DAYS);

  return (
    limit !== null &&
    Temporal.PlainDate.compare(localDateOf(schedule, lastInstant), limit) >= 0
  );
}

/**
 * The text of a run's edges: the range's own where the run was clipped to it, else the instant's
 * UTC string, written here and only for the runs a caller returns.
 */
export function runText(run: IntervalNanoseconds): {
  start: string;
  end: string;
} {
  return {
    start: run.startText === "" ? instantText(run.start) : run.startText,
    end: run.endText === "" ? instantText(run.end) : run.endText,
  };
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
  return spansTooManyDates(schedule, range)
    ? null
    : walkedRunsWithin(schedule, range, disambiguation);
}

/**
 * `scheduleRunsWithin` for a range already known to span few enough local dates, as every piece
 * of such a range does: a piece starts no earlier and ends no later, so it cannot reach the limit.
 */
function walkedRunsWithin(
  schedule: ResolvedSchedule,
  range: IntervalNanoseconds,
  disambiguation: Disambiguation,
  timeline?: OffsetTimeline,
): IntervalNanoseconds[] | null {
  const runs: IntervalNanoseconds[] = [];

  const walked = walkSchedule(
    schedule,
    range.start,
    disambiguation,
    {
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
    },
    timeline,
  );

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
 * Walk from `fromNs` until a caller can answer. `atRun` sees each finished run that ends after
 * `fromNs`, and `atDay` the first pending run that does when no later window can start before
 * `bound`; each returns the answer, or `undefined` to keep walking. Past `horizonNs` the walk
 * stops unanswered. `null` when the walk fails.
 */
function firstAnswer(
  schedule: ResolvedSchedule,
  fromNs: bigint,
  horizonNs: bigint,
  disambiguation: Disambiguation,
  atRun: (run: IntervalNanoseconds) => bigint | undefined,
  atDay: (
    bound: bigint,
    next: IntervalNanoseconds | undefined,
  ) => bigint | undefined,
): { answer: bigint | undefined; unresolvedStart: bigint | undefined } | null {
  let answer: bigint | undefined;

  const walked = walkSchedule(schedule, fromNs, disambiguation, {
    run: (run) => {
      if (answer === undefined && run.end > fromNs) {
        answer = atRun(run);
      }

      return answer !== undefined;
    },
    day: (bound, pending) => {
      if (bound > horizonNs) {
        return true;
      }

      answer = atDay(
        bound,
        pending.find((run) => run.end > fromNs),
      );

      return answer !== undefined;
    },
  });

  return walked === null
    ? null
    : { answer, unresolvedStart: walked.unresolvedStart };
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
  const walked = firstAnswer(
    schedule,
    fromNs,
    horizonNs,
    disambiguation,
    (run) => later(run.start, fromNs),
    (bound, next) =>
      next !== undefined && later(next.start, fromNs) <= bound
        ? later(next.start, fromNs)
        : undefined,
  );

  if (walked === null) {
    return null;
  }

  const { answer, unresolvedStart } = walked;

  if (answer === undefined || answer > horizonNs) {
    return undefined;
  }

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
  const walked = firstAnswer(
    schedule,
    fromNs,
    horizonNs,
    disambiguation,
    (run) => (run.start <= fromNs ? run.end : fromNs),
    // Closed at `fromNs`, and every later window starts after it.
    (bound, next) =>
      fromNs < bound && (next === undefined || next.start > fromNs)
        ? fromNs
        : undefined,
  );

  if (walked === null) {
    return null;
  }

  const closed = walked.answer ?? fromNs;

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

  const jump = jumpOverWholeDays(
    schedule,
    fromNs,
    amountNs,
    horizonNs,
    disambiguation,
  );

  return walkForOpenTime(
    schedule,
    jump?.startNs ?? fromNs,
    jump?.remaining ?? amountNs,
    horizonNs,
    disambiguation,
  );
}

/** `instantAfterOpenTime` by walking dates from `fromNs`. */
function walkForOpenTime(
  schedule: ResolvedSchedule,
  fromNs: bigint,
  amountNs: bigint,
  horizonNs: bigint,
  disambiguation: Disambiguation,
): bigint | undefined | null {
  let remaining = amountNs;

  const walked = firstAnswer(
    schedule,
    fromNs,
    horizonNs,
    disambiguation,
    (run) => {
      const start = later(run.start, fromNs);

      if (run.end - start >= remaining) {
        return start + remaining;
      }

      remaining -= run.end - start;
      return undefined;
    },
    // Every pending run ends at or after `bound`, so only the first can hold a deadline at or
    // before it; open time before `bound` is final.
    (bound, next) => {
      if (next === undefined) {
        return undefined;
      }

      const deadline = later(next.start, fromNs) + remaining;

      return deadline <= next.end && deadline <= bound ? deadline : undefined;
    },
  );

  if (walked === null) {
    return null;
  }

  const { answer, unresolvedStart } = walked;

  if (answer === undefined || answer > horizonNs) {
    return undefined;
  }

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

/** `a / b` rounded toward negative infinity, for a positive `b`. */
function floorDivide(a: bigint, b: bigint): bigint {
  const quotient = a / b;

  return a % b < 0n ? quotient - 1n : quotient;
}

/** `a / b` rounded toward positive infinity, for a positive `b`. */
function ceilDivide(a: bigint, b: bigint): bigint {
  return -floorDivide(-a, b);
}

/** Length of the union of `spans`, each `[start, end)`. */
function unionLength(spans: [bigint, bigint][]): bigint {
  spans.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));

  let total = 0n;
  let reached = 0n;

  for (const [start, end] of spans) {
    const from = start > reached ? start : reached;

    if (end > from) {
      total += end - from;
      reached = end;
    }
  }

  return total;
}

/**
 * Open time inside the day bucket of a quiet date: the tails of the previous date's wrapping
 * windows (`[0, to)`) and the date's own windows (`[from, to)`, or `[from, 1 day)` when wrapping),
 * as a union.
 */
function dayCoverage(
  previous: readonly ResolvedWindow[],
  current: readonly ResolvedWindow[],
): bigint {
  const spans: [bigint, bigint][] = [];

  for (const window of previous) {
    if (window.wraps) {
      spans.push([0n, window.toNs]);
    }
  }

  for (const window of current) {
    spans.push([
      window.fromNs,
      window.wraps ? NANOSECONDS_PER_DAY : window.toNs,
    ]);
  }

  return unionLength(spans);
}

/** A run of quiet dates inside a range: its first and last epoch day, and the bucket span they cover. */
type QuietBlock = {
  firstDay: number;
  lastDay: number;
  startNs: bigint;
  endNs: bigint;
};

/**
 * The maximal blocks of quiet dates lying wholly inside `range`, ascending. A date `d` is quiet
 * when one stretch, offset `o`, holds every instant from `(d - 2)` days `- o` to `(d + 3)` days
 * `- o`: every wall time on `d - 1`, `d` and `d + 1` then has the one candidate `wall - o` under
 * every policy, and `d`'s bucket is exactly one day. A refused edge has a change within a day of
 * it, so none reaches a quiet date.
 */
function quietBlocks(
  timeline: OffsetTimeline,
  range: IntervalNanoseconds,
): QuietBlock[] {
  const { changes, offsets } = timeline;
  const day = NANOSECONDS_PER_DAY;
  const blocks: QuietBlock[] = [];

  for (let index = 0; index < offsets.length; index++) {
    const offset = offsets[index];
    const low = index === 0 ? timeline.fromNs : changes[index - 1];
    const high = index === changes.length ? timeline.toNs : changes[index];
    const first = ceilDivide(low + offset, day) + 2n;
    const last = floorDivide(high - 1n + offset, day) - 3n;
    const insideFirst = ceilDivide(range.start + offset, day);
    const insideLast = floorDivide(range.end + offset, day) - 1n;
    const firstDay = first > insideFirst ? first : insideFirst;
    const lastDay = last < insideLast ? last : insideLast;

    if (firstDay <= lastDay) {
      blocks.push({
        firstDay: Number(firstDay),
        lastDay: Number(lastDay),
        startNs: firstDay * day - offset,
        endNs: (lastDay + 1n) * day - offset,
      });
    }
  }

  return blocks;
}

/** The open time each date adds to the plain week, indexed by ISO weekday (index 0 is unused). */
function plainWeekCoverage(schedule: ResolvedSchedule): bigint[] {
  const plain: bigint[] = [0n];

  for (let weekday = 1; weekday <= ISO_WEEKDAYS; weekday++) {
    plain.push(
      dayCoverage(
        schedule.weekly[weekday === 1 ? ISO_WEEKDAYS : weekday - 1],
        schedule.weekly[weekday],
      ),
    );
  }

  return plain;
}

/**
 * What the holiday and override dates of a quiet block change from the plain week. A date differs
 * from it when it or the date before it is a holiday or override.
 */
function specialDayCorrection(
  schedule: ResolvedSchedule,
  block: QuietBlock,
  plain: readonly bigint[],
): bigint {
  const { specials } = schedule;
  let total = 0n;
  let handled = block.firstDay - 1;

  for (
    let index = lowerBound(specials, block.firstDay - 1);
    index < specials.length && specials[index] <= block.lastDay;
    index++
  ) {
    for (const day of [specials[index], specials[index] + 1]) {
      if (day > handled && day >= block.firstDay && day <= block.lastDay) {
        total +=
          dayCoverage(
            windowsOnDay(schedule, day - 1),
            windowsOnDay(schedule, day),
          ) - plain[isoWeekdayOf(day)];
        handled = day;
      }
    }
  }

  return total;
}

/** Open time over the dates of a quiet block, from the weekly pattern and the special days. */
function quietBlockOpenTime(
  schedule: ResolvedSchedule,
  block: QuietBlock,
): bigint {
  const plain = plainWeekCoverage(schedule);
  const dates = block.lastDay - block.firstDay + 1;
  const leftover = dates % ISO_WEEKDAYS;
  let week = 0n;

  for (let weekday = 1; weekday <= ISO_WEEKDAYS; weekday++) {
    week += plain[weekday];
  }

  let total = week * BigInt(Math.floor(dates / ISO_WEEKDAYS));

  for (let offset = 0; offset < leftover; offset++) {
    total += plain[isoWeekdayOf(block.firstDay + offset)];
  }

  return total + specialDayCorrection(schedule, block, plain);
}

/**
 * Open time in `[start, end)` by walking its dates, or `null` as `scheduleRunsWithin` is.
 * `timeline` is one a caller already built for the pieces of a range.
 */
function walkedOpenTime(
  schedule: ResolvedSchedule,
  start: bigint,
  end: bigint,
  disambiguation: Disambiguation,
  timeline?: OffsetTimeline,
): bigint | null {
  const runs = walkedRunsWithin(
    schedule,
    { start, end, startText: "", endText: "" },
    disambiguation,
    timeline,
  );

  return runs === null
    ? null
    : runs.reduce((total, run) => total + (run.end - run.start), 0n);
}

/**
 * Open time in `[range.start, range.end)`, in nanoseconds; `null` exactly when
 * `scheduleRunsWithin` would be.
 *
 * Open time is additive over disjoint half-open pieces. Whole day buckets inside a stretch of
 * constant offset are summed in closed form (whole weeks of the weekly pattern, plus a correction
 * for each holiday and override); the pieces between them, the range's ends and the dates near an
 * offset change, are walked.
 */
export function openTimeWithin(
  schedule: ResolvedSchedule,
  range: IntervalNanoseconds,
  disambiguation: Disambiguation,
): bigint | null {
  if (spansTooManyDates(schedule, range)) {
    return null;
  }

  let total = 0n;
  let cursor = range.start;
  let timeline: OffsetTimeline | undefined;

  if (!walkNearsLimits(range.start)) {
    timeline = offsetTimeline(
      schedule.frame,
      range.start - 12n * NANOSECONDS_PER_DAY,
      range.end + 6n * NANOSECONDS_PER_DAY,
    );

    for (const block of quietBlocks(timeline, range)) {
      const piece = walkedOpenTime(
        schedule,
        cursor,
        block.startNs,
        disambiguation,
        timeline,
      );

      if (piece === null) {
        return null;
      }

      total += piece + quietBlockOpenTime(schedule, block);
      cursor = block.endNs;
    }
  }

  const last = walkedOpenTime(
    schedule,
    cursor,
    range.end,
    disambiguation,
    timeline,
  );

  return last === null ? null : total + last;
}

/**
 * Where `instantAfterOpenTime` can start walking: the first instant of the latest local date
 * whose start still has less than `amountNs` of open time before it, and the open time left after
 * that. A date that starts at or before `fromNs` (a fall-back repeats local midnight) starts at
 * `fromNs` instead, with nothing counted before it: counting from an earlier start would add open
 * time that precedes `fromNs`. Equal by additivity: the answer `X` has
 * `open[fromNs, X) = amountNs`, so it lies after that start. `undefined` when no date qualifies, when the walk could near Temporal's limits, or
 * when `openTimeWithin` is `null` (a window refused under `"reject"`): the walk then starts at
 * `fromNs`.
 */
function jumpOverWholeDays(
  schedule: ResolvedSchedule,
  fromNs: bigint,
  amountNs: bigint,
  horizonNs: bigint,
  disambiguation: Disambiguation,
): { startNs: bigint; remaining: bigint } | undefined {
  if (walkNearsLimits(fromNs)) {
    return undefined;
  }

  const timeline = offsetTimeline(
    schedule.frame,
    fromNs - 6n * NANOSECONDS_PER_DAY,
    fromNs + 14n * NANOSECONDS_PER_DAY,
  );
  const firstDay = localDayOf(timeline, fromNs);
  const lastDay = localDayOf(timeline, horizonNs);
  // The open time before the start of `day`: below `amountNs`, or not (`undefined`: `null`).
  const before = (day: number): [bigint, bigint] | undefined => {
    ensureTimeline(timeline, BigInt(day + 6) * NANOSECONDS_PER_DAY);

    const dayStart = startOfDayNs(timeline, day);
    const startNs = dayStart > fromNs ? dayStart : fromNs;
    const open = openTimeWithin(
      schedule,
      { start: fromNs, end: startNs, startText: "", endText: "" },
      disambiguation,
    );

    return open === null ? undefined : [startNs, open];
  };

  const found = latestDayBelow(firstDay, lastDay, amountNs, before);

  if (found === undefined) {
    return undefined;
  }

  return { startNs: found.startNs, remaining: amountNs - found.open };
}

/** A local date, the instant it starts and the open time before that instant. */
type ProbedDay = { day: number; startNs: bigint; open: bigint };

/**
 * The latest date in `(firstDay, lastDay]` whose probe reads less than `amountNs`: gallop away
 * from `firstDay`, then bisect between the last date below and the first not. `undefined` when
 * there is none or a probe is `undefined`.
 */
function latestDayBelow(
  firstDay: number,
  lastDay: number,
  amountNs: bigint,
  before: (day: number) => [bigint, bigint] | undefined,
): ProbedDay | undefined {
  let good: ProbedDay | undefined;
  let bad = lastDay + 1;

  for (let step = 1; firstDay + step <= lastDay; step *= 2) {
    const probed = before(firstDay + step);

    if (probed === undefined) {
      return undefined;
    }

    if (probed[1] >= amountNs) {
      bad = firstDay + step;
      break;
    }

    good = { day: firstDay + step, startNs: probed[0], open: probed[1] };
  }

  while (good !== undefined && bad - good.day > 1) {
    const middle = good.day + Math.floor((bad - good.day) / 2);
    const probed = before(middle);

    if (probed === undefined) {
      return undefined;
    }

    if (probed[1] >= amountNs) {
      bad = middle;
    } else {
      good = { day: middle, startNs: probed[0], open: probed[1] };
    }
  }

  return good;
}
