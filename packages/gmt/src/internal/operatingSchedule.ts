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
 * Local days one walk may visit before giving up: about 27 years, the same bound `bucketRange`
 * puts on a day walk. A walk that runs out answers with the sentinel, never a partial list.
 */
export const MAX_SCHEDULE_DAYS = 10_000;

/**
 * How far before the first instant of interest the walk starts. A window is at most one local
 * day of wall time, but a resolved edge can land a whole deleted day later (`Pacific/Apia`
 * skipped 2011-12-30), so a window that started up to two days earlier can still be open.
 * Three days clears that with room to spare.
 */
const LOOKBACK = Temporal.Duration.from({ hours: 72 });

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
 * the schedule's zone so `P1D` is one local day. `null` when `within` is not a non-negative ISO
 * duration or the horizon is not representable.
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

  try {
    const duration = Temporal.Duration.from(text);

    if (duration.sign < 0) {
      return null;
    }

    return Temporal.Instant.fromEpochNanoseconds(fromNs)
      .toZonedDateTimeISO(timeZone)
      .add(duration).epochNanoseconds;
  } catch {
    return null;
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

/**
 * Resolve one date's windows to instants with `resolveLocal`. Each edge is resolved on its own
 * under `disambiguation`; a wrapping window's `to` is read on the next date. An edge pair that
 * resolves to an empty or inverted span (a window shorter than the gap it straddles) is dropped.
 *
 * Under `"reject"`, a window with an ambiguous or nonexistent edge is not guessed: it is returned
 * in `unresolved` as the widest span it could cover (its start read `"earlier"`, its end
 * `"later"`), so the caller can refuse an answer it might change and ignore it elsewhere.
 * Returns `null` when an edge is outside Temporal's range.
 */
function resolveDateWindows(
  schedule: ResolvedSchedule,
  date: Temporal.PlainDate,
  disambiguation: Disambiguation,
): { records: IntervalNanoseconds[]; unresolved: Unresolved[] } | null {
  const records: IntervalNanoseconds[] = [];
  const unresolved: Unresolved[] = [];

  for (const window of windowsOn(schedule, date)) {
    const endDate = window.wraps ? date.add({ days: 1 }) : date;
    const startLocal = `${date.toString()}T${window.from}`;
    const endLocal = `${endDate.toString()}T${window.to}`;
    const startText = resolveLocal(startLocal, schedule.timeZone, {
      disambiguation,
    });
    const endText = resolveLocal(endLocal, schedule.timeZone, {
      disambiguation,
    });

    if (startText === "" || endText === "") {
      const earliest = resolveLocal(startLocal, schedule.timeZone, {
        disambiguation: "earlier",
      });
      const latest = resolveLocal(endLocal, schedule.timeZone, {
        disambiguation: "later",
      });

      // Outside Temporal's range, or a policy other than "reject" failing: no answer at all.
      if (disambiguation !== "reject" || earliest === "" || latest === "") {
        return null;
      }

      unresolved.push({
        start: Temporal.Instant.from(earliest).epochNanoseconds,
        end: Temporal.Instant.from(latest).epochNanoseconds,
      });
      continue;
    }

    const start = Temporal.Instant.from(startText).epochNanoseconds;
    const end = Temporal.Instant.from(endText).epochNanoseconds;

    if (start < end) {
      records.push({ start, end, startText, endText });
    }
  }

  return { records, unresolved };
}

/**
 * What the walk tells its caller.
 *
 * - `run` is a finished open run: sorted, disjoint, non-touching and never extended later.
 * - `day` announces that every window still to come starts at or after `dayStart`. Returning
 *   `true` from either stops the walk.
 */
export type ScheduleVisitor = {
  run: (run: IntervalNanoseconds) => boolean;
  day: (dayStart: bigint) => boolean;
};

/**
 * How a walk ended. `unresolvedStart` is the earliest instant a window rejected under
 * `"reject"` could open at, among those that could still be open at or after `fromNs`;
 * `undefined` when there is none. Every such window on a date the walk did not reach starts
 * after every run it handed over.
 */
export type ScheduleWalk = { unresolvedStart: bigint | undefined };

/**
 * Walk the schedule's local dates from a little before `fromNs`, handing the visitor each open
 * run as soon as no later window can extend it.
 *
 * - Dates come from the day buckets `floorToZone` and `bucketRange` use, so a deleted date
 *   (`Pacific/Apia`, 2011-12-30) is never visited, and a date the clock re-enters after a
 *   fall-back (`America/Goose_Bay`, 2010-11-06) is visited once.
 * - Every window of a later date starts at or after that date's first instant, so a run ending
 *   before it is final. When the visitor stops the walk, or the last representable day is
 *   reached, the runs still pending are handed over too.
 * - Returns `null` when an edge is outside Temporal's range, a day bucket could not be found, or
 *   `MAX_SCHEDULE_DAYS` dates went by first.
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

  let current: Temporal.ZonedDateTime | null = zonedUnitStart(
    Temporal.Instant.fromEpochNanoseconds(fromNs)
      .subtract(LOOKBACK)
      .toZonedDateTimeISO(schedule.timeZone),
    "day",
  );
  let lastDate: Temporal.PlainDate | null = null;

  for (let day = 0; day < MAX_SCHEDULE_DAYS; day++) {
    if (current === null) {
      return null;
    }

    const dayStart = current.epochNanoseconds;
    const settled = pending.filter((run) => run.end < dayStart);

    for (const run of settled) {
      if (visitor.run(run)) {
        return finish();
      }
    }

    pending = pending.filter((run) => run.end >= dayStart);

    if (visitor.day(dayStart)) {
      return flush();
    }

    const date = current.toPlainDate();

    // A fall-back that re-enters the previous date opens a second bucket for it; its windows
    // were already resolved on the first visit.
    if (lastDate === null || Temporal.PlainDate.compare(date, lastDate) > 0) {
      const resolved = resolveDateWindows(schedule, date, disambiguation);

      if (resolved === null) {
        return null;
      }

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
    day: (dayStart) => dayStart >= range.end,
  });

  if (
    walked === null ||
    (walked.unresolvedStart !== undefined && walked.unresolvedStart < range.end)
  ) {
    return null;
  }

  return runs.filter((run) => run.start < run.end);
}

/**
 * The first instant at or after `fromNs` that the schedule is open: `fromNs` itself inside an
 * open run, else the start of the next run. `undefined` when none falls at or before
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
      if (run.end <= fromNs) {
        return false;
      }
      answer = run.start > fromNs ? run.start : fromNs;
      return true;
    },
    day: (dayStart) => dayStart > horizonNs,
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
 * every open run, else the end of the run holding it. `undefined` when that falls after
 * `horizonNs`, `null` when the walk fails or a window rejected under `"reject"` could keep the
 * schedule open past it.
 */
export function firstClosedInstant(
  schedule: ResolvedSchedule,
  fromNs: bigint,
  horizonNs: bigint,
  disambiguation: Disambiguation,
): bigint | undefined | null {
  let answer = fromNs;

  const walked = walkSchedule(schedule, fromNs, disambiguation, {
    run: (run) => {
      if (run.end <= fromNs) {
        return false;
      }
      if (run.start <= fromNs) {
        answer = run.end;
      }
      return true;
    },
    day: (dayStart) => dayStart > horizonNs,
  });

  if (walked === null) {
    return null;
  }

  if (answer > horizonNs) {
    return undefined;
  }

  const { unresolvedStart } = walked;

  return unresolvedStart !== undefined && unresolvedStart <= answer
    ? null
    : answer;
}

/**
 * The instant at which `amountNs` of open time has elapsed since `fromNs`: the earliest `X`
 * with exactly that much open time in `[fromNs, X)`. `fromNs` itself when `amountNs` is zero.
 * `undefined` when `X` falls after `horizonNs`, `null` when the walk fails or a window rejected
 * under `"reject"` could add open time before `X`.
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
      if (run.end <= fromNs) {
        return false;
      }

      const start = run.start > fromNs ? run.start : fromNs;

      if (run.end - start >= remaining) {
        answer = start + remaining;
        return true;
      }

      remaining -= run.end - start;
      return false;
    },
    day: (dayStart) => dayStart > horizonNs,
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
