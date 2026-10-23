import { checkCronExpression } from "../../internal/cronText";
import { nextCronDay } from "../../internal/cronMatch";
import { isoDateString, MIN_EPOCH_DAY } from "../../internal/epochDay";
import { instantStringFromEpochNanoseconds } from "../../internal/instantStringFromEpochNanoseconds";
import {
  createLocalResolver,
  localNanoseconds,
  readOccurrenceWindow,
  type OccurrenceWindowNanoseconds,
  type ResolvedLocal,
} from "../../internal/localResolution";
import {
  RECURRENCE_WORK_CAP,
  type LocalMoment,
} from "../../internal/recurrenceExpansion";
import { zoneFrame } from "../../internal/zoneFrame";
import type {
  CronExpression,
  CronRun,
  CronTransitionPolicy,
  OccurrenceWindow,
} from "../../types";

const NANOSECONDS_PER_SECOND = 1_000_000_000n;
const SECONDS_PER_DAY = 86_400;
const DAY = BigInt(SECONDS_PER_DAY) * NANOSECONDS_PER_SECOND;
/**
 * A moment read as UTC is within a day and a bit of the instant it names (no offset reaches
 * 26 hours), so three days of slack never drops a run and never keeps a loop running.
 */
const SLACK_DAYS = 3;
const SLACK = BigInt(SLACK_DAYS) * DAY;
const MAX_ROWS = 10_000;
/**
 * cronie `cron.c` (lines 370-398): `timeDiff` is the shift in minutes plus the one-minute tick, and
 * a `timeDiff` over `3 * MINUTE_COUNT` (180) is "large": the daemon just uses the new time. A
 * forward shift of exactly 3 h gives 181, which is large, so a gap is caught up only when it is
 * under `CATCH_UP_LIMIT`. A backward shift of exactly 3 h gives -179, which is "negative" (no
 * re-run) and not large, so an overlap is not re-run up to and including `CATCH_UP_LIMIT`.
 */
const CATCH_UP_LIMIT = 3n * 3_600n * NANOSECONDS_PER_SECOND;

type Row = {
  day: number;
  second: number;
  instant: bigint;
  kind: ResolvedLocal["kind"];
};

/** The sorted minutes of the day, in seconds, at which the schedule fires on a matching day. */
function timesOf(e: CronExpression): number[] {
  const times: number[] = [];

  for (const hour of e.hour.values) {
    for (const minute of e.minute.values) {
      times.push(hour * 3600 + minute * 60);
    }
  }

  return times;
}

/**
 * The instants one scheduled wall time runs at.
 *
 * `crontabMatch` follows crontab(5): a skipped time "will never match", a repeated one runs twice.
 * `daemonCatchUp` follows cronie cron(8) / Debian cron(8) for a fixed-time job and an offset change
 * (a gap under 3 h, an overlap of at most 3 h, as cron.c's `timeDiff` arithmetic gives): a skipped
 * time runs once, soon after the change (at the transition), and a repeated time is not run again.
 * Every other job and change is treated as in `crontabMatch`.
 */
function instantsOf(
  resolved: ResolvedLocal,
  policy: CronTransitionPolicy,
  fixedTime: boolean,
): bigint[] {
  if (resolved.kind === "unique") {
    return [resolved.earlier];
  }

  const shift = resolved.later - resolved.earlier;
  const caughtUp =
    policy === "daemonCatchUp" &&
    fixedTime &&
    (resolved.kind === "nonexistent"
      ? shift < CATCH_UP_LIMIT
      : shift <= CATCH_UP_LIMIT);

  if (resolved.kind === "nonexistent") {
    return caughtUp ? [resolved.transition!] : [];
  }

  return caughtUp ? [resolved.earlier] : [resolved.earlier, resolved.later];
}

function floorDay(nanoseconds: bigint): number {
  const days = nanoseconds / DAY;

  return Number(
    nanoseconds < 0n && nanoseconds % DAY !== 0n ? days - 1n : days,
  );
}

function isInside(
  window: OccurrenceWindowNanoseconds,
  instant: bigint,
): boolean {
  return window.kind === "after"
    ? instant > window.after
    : instant >= window.start && instant < window.end;
}

function compareRows(a: Row, b: Row): number {
  if (a.instant !== b.instant) {
    return a.instant < b.instant ? -1 : 1;
  }

  return a.day === b.day ? a.second - b.second : a.day - b.day;
}

function localOf(row: Row): string {
  const part = (value: number): string => String(value).padStart(2, "0");

  return `${isoDateString(row.day)}T${part(Math.floor(row.second / 3600))}:${part(Math.floor((row.second % 3600) / 60))}:00`;
}

/** The rows kept so far, and the bound past which later days cannot matter. */
type Collector = {
  rows: Row[];
  /** Whether an interval window already holds more rows than a call may return. */
  over(): boolean;
  /** Moments read as UTC beyond this are not looked at, or null while unbounded. */
  limit(): bigint | null;
  add(row: Row): void;
  /** Called after each day: the `count` form keeps only its `count` nearest rows. */
  endDay(): void;
};

function createCollector(window: OccurrenceWindowNanoseconds): Collector {
  const rows: Row[] = [];
  /** The instant of the `count`-th nearest row, once there are `count` rows (the `count` form). */
  let farthest: bigint | null = null;

  return {
    rows,
    over: () => window.kind === "interval" && rows.length > MAX_ROWS,
    limit() {
      if (window.kind === "interval") {
        return window.end + SLACK;
      }

      return farthest === null ? null : farthest + SLACK;
    },
    add(row) {
      // A row past the count-th nearest instant can never be among the first `count`.
      if (farthest === null || row.instant <= farthest) {
        rows.push(row);
      }
    },
    endDay() {
      if (window.kind === "after" && rows.length >= window.count) {
        rows.sort(compareRows);
        rows.length = window.count;
        farthest = rows[window.count - 1]!.instant;
      }
    },
  };
}

type Call = {
  expression: CronExpression;
  frame: NonNullable<ReturnType<typeof zoneFrame>>;
  window: OccurrenceWindowNanoseconds;
  policy: CronTransitionPolicy;
};

function readCall(
  expression: CronExpression,
  timeZone: string,
  window: OccurrenceWindow,
  policy: CronTransitionPolicy,
): Call | null {
  const checked = checkCronExpression(expression);
  const frame = zoneFrame(timeZone);
  const read = readOccurrenceWindow(window);

  if (
    checked === null ||
    frame === null ||
    read === null ||
    (policy !== "crontabMatch" && policy !== "daemonCatchUp")
  ) {
    return null;
  }

  return { expression: checked, frame, window: read, policy };
}

/**
 * No UTC offset reaches 24 hours (TC39 `IsValidOffsetNanoseconds` / `ParseTimeZoneIdentifier`:
 * |offset| < 24 h), so a wall time read as UTC lies within 24 hours of every instant it can name.
 * That covers a repeated or skipped time too: its transition lies between its two readings.
 */
const OFFSET_BOUND = DAY;

/** The index of the first sorted wall time of `day` that can reach the window's lower bound. */
function firstReaching(
  window: OccurrenceWindowNanoseconds,
  times: readonly number[],
  day: number,
): number {
  const lower = window.kind === "after" ? window.after : window.start;
  let low = 0;
  let high = times.length;

  while (low < high) {
    const middle = (low + high) >> 1;

    if (
      localNanoseconds({ day, second: times[middle]! }) + OFFSET_BOUND >
      lower
    ) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }

  return low;
}

/**
 * Place the wall times of one matching day that can reach the window and keep the runs inside it.
 *
 * A wall time `w` (read as UTC) names instants strictly between `w - OFFSET_BOUND` and
 * `w + OFFSET_BOUND`, so it cannot reach the window when `w + OFFSET_BOUND` is at or before the
 * window's lower bound, or `w - OFFSET_BOUND` is at or after its end. The sorted `times` are
 * searched for the first one that can reach it and the loop stops at the first that is past it.
 * Loop bound: at most `times.length` (at most 1,440) steps, a binary search of `log2` of that.
 */
function placeDay(
  call: Call,
  resolve: (moment: LocalMoment) => ResolvedLocal,
  times: readonly number[],
  day: number,
  collector: Collector,
): void {
  const fixedTime = !call.expression.minute.star && !call.expression.hour.star;
  const wall = (second: number) => localNanoseconds({ day, second });
  const upper = call.window.kind === "after" ? null : call.window.end;

  for (
    let index = firstReaching(call.window, times, day);
    index < times.length;
    index += 1
  ) {
    const second = times[index]!;

    if (upper !== null && wall(second) - OFFSET_BOUND >= upper) {
      break;
    }

    const resolved = resolve({ day, second });

    for (const instant of instantsOf(resolved, call.policy, fixedTime)) {
      if (isInside(call.window, instant)) {
        collector.add({ day, second, instant, kind: resolved.kind });
      }
    }
  }

  collector.endDay();
}

/**
 * Walk the matching days from three days before the window and collect the runs inside it.
 * Returns null when the work cap ended the walk.
 *
 * Every loop step is bounded: the day scan by one Gregorian cycle (146,097 days) per match and by
 * the limit (the window's end plus three days, or the `count`-th nearest run plus three days),
 * the times by `hour.values × minute.values` (at most 1,440) per matching day, and the whole
 * walk by `RECURRENCE_WORK_CAP` work units (one per day scanned and one per wall time of each
 * matching day, whether or not it can reach the window), the row cap, and the window's end plus
 * three days.
 */
function collect(call: Call): Row[] | null {
  const resolve = createLocalResolver(call.frame);
  const times = timesOf(call.expression);
  const collector = createCollector(call.window);
  const lower =
    call.window.kind === "after" ? call.window.after : call.window.start;
  let day = Math.max(MIN_EPOCH_DAY, floorDay(lower) - SLACK_DAYS);
  let work = 0;

  while (!collector.over()) {
    const limit = collector.limit();
    // A day whose midnight, read as UTC, is past the limit cannot matter: stop the scan there.
    const next = nextCronDay(
      call.expression,
      day,
      limit === null ? undefined : floorDay(limit),
    );

    if (next === null) {
      break;
    }

    work += next - day + 1 + times.length;

    if (work > RECURRENCE_WORK_CAP) {
      return null;
    }

    placeDay(call, resolve, times, next, collector);
    day = next + 1;
  }

  return collector.over() ? null : collector.rows;
}

function runOf(row: Row): CronRun | null {
  const instant = instantStringFromEpochNanoseconds(row.instant);

  return instant === ""
    ? null
    : { local: localOf(row), instant, classification: row.kind };
}

/**
 * The runs of a five-field cron schedule inside a window, in a time zone.
 *
 * `expression` is a parsed schedule (`parseCronExpression`). Its wall times are read in `timeZone`
 * and the seconds are always 0.
 *
 * - **Day rule.** The month always has to match. Day of month and day of week are ORed when both
 *   are restricted (neither is `*`) and ANDed otherwise (crontab(5) NOTES; cronie `cron.c`).
 *   POSIX's wording also ORs when the month is restricted; no shipped cron does, and GMT does not.
 * - **Window.** An interval (`start` up to but not including `end`) or the first `count` runs after
 *   an instant (1 to 10,000).
 * - **`policy` is required**, because real cron daemons differ and a default would pick one
 *   silently. It says what happens to a scheduled wall time that a zone change skips or repeats,
 *   in the vocabulary of `classifyLocal`: `"unique"`, `"nonexistent"` (skipped) or `"ambiguous"`
 *   (repeated). Each run's `classification` says which it was.
 *   - `"crontabMatch"` matches the schedule against each real wall time (crontab(5)). A
 *     `"nonexistent"` time "will never match": no run. An `"ambiguous"` time runs twice, once at
 *     each instant.
 *   - `"daemonCatchUp"` models what cron(8) documents for a running daemon (Debian and
 *     cronie), applied to every offset change; cronie's code reacts only to a change of the DST
 *     flag. For a fixed-time job (neither minute nor hour is `*`), a `"nonexistent"` time in a gap
 *     of under 3 hours runs once at the transition, `local` still the wall time the schedule
 *     named, and an `"ambiguous"` time in an overlap of at most 3 hours runs once at the earlier
 *     instant, not again (cron.c adds a one-minute tick to the shift, so a gap of exactly 3 hours
 *     is "large" and an overlap of exactly 3 hours is not). For any other job or a larger change,
 *     it behaves like `"crontabMatch"`. It leaves out cron(8)'s minute-level case for a "small
 *     change" (a clock step of five minutes or less), because GMT models offset changes and not
 *     clock steps. It also leaves out `CRON_TZ`.
 * - Runs that share an instant stay separate rows: each is a separate execution.
 * - `timeZone` is a time zone identifier or a fixed offset (`+05:30`).
 *
 * Returns `[]` for an invalid argument (including a missing or unknown `policy`), a schedule that
 * never matches (such as February 30), and a result of more than 10,000 runs. A run whose instant
 * is past Temporal's range (after +275760-09-13T00:00:00Z) is past the end of the schedule: it is
 * left out and the runs before it are returned.
 *
 * Complexity: O(S + R + K) for S the days scanned (the window's days, or at most 146,097 for an
 * expression that never matches), R the runs and K the zone transitions near them. The walk spends
 * at most 2,000,000 work units and returns `[]` if it needs more.
 *
 * @param expression a cron schedule, from `parseCronExpression`
 * @param timeZone an IANA time zone or fixed offset
 * @param window the interval or `{ after, count }` to list
 * @param policy `"crontabMatch"` or `"daemonCatchUp"`
 * @returns the runs sorted by `instant`, then by `local`, or `[]`
 *
 * @example cronRuns({ minute: { values: [30], star: false }, hour: { values: [2], star: false }, dayOfMonth: { values: [10], star: false }, month: { values: [3], star: false }, dayOfWeek: { values: [1, 2, 3, 4, 5, 6, 7], star: true } }, "America/New_York", { start: "2024-03-10T00:00:00Z", end: "2024-03-11T00:00:00Z" }, "daemonCatchUp") // [{ local: "2024-03-10T02:30:00", instant: "2024-03-10T07:00:00Z", classification: "nonexistent" }]
 * @example cronRuns(parseCronExpression("30 2 * * *"), "America/New_York", { start: "2024-03-09T00:00:00Z", end: "2024-03-12T00:00:00Z" }, "crontabMatch").map((run) => run.instant) // ["2024-03-09T07:30:00Z", "2024-03-11T06:30:00Z"] (no 02:30 on March 10)
 * @example cronRuns(parseCronExpression("30 1 * * *"), "America/New_York", { start: "2024-11-03T00:00:00Z", end: "2024-11-04T00:00:00Z" }, "crontabMatch").map((run) => run.instant) // ["2024-11-03T05:30:00Z", "2024-11-03T06:30:00Z"] (01:30 repeats)
 * @example cronRuns(parseCronExpression("0 0 29 2 *"), "UTC", { after: "2025-01-01T00:00:00Z", count: 2 }, "crontabMatch").map((run) => run.local) // ["2028-02-29T00:00:00", "2032-02-29T00:00:00"]
 * @example cronRuns(parseCronExpression("0 0 * * *"), "UTC", { after: "2024-01-01T00:00:00Z", count: 1 }, undefined) // [] (a policy is required)
 * @example cronRuns(parseCronExpression("0 0 30 2 *"), "UTC", { after: "2024-01-01T00:00:00Z", count: 1 }, "crontabMatch") // [] (February 30 never comes)
 */
export function cronRuns(
  expression: CronExpression,
  timeZone: string,
  window: OccurrenceWindow,
  policy: CronTransitionPolicy,
): CronRun[] {
  try {
    const call = readCall(expression, timeZone, window, policy);

    if (call === null) {
      return [];
    }

    const rows = collect(call);

    if (rows === null) {
      return [];
    }

    rows.sort(compareRows);

    const chosen =
      call.window.kind === "after" ? rows.slice(0, call.window.count) : rows;

    if (chosen.length > MAX_ROWS) {
      return [];
    }

    // An instant past Temporal's range is past the end of the schedule: drop it (the rows are
    // sorted, so only the last ones can be past it) and return the runs found.
    return chosen.flatMap((row) => runOf(row) ?? []);
  } catch {
    return [];
  }
}
