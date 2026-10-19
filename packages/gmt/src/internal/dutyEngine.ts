import { Temporal } from "./temporal";
import type {
  Disambiguation,
  DutyViolation,
  Interval,
  PeriodBasis,
  RuleOutcome,
} from "../types";
import { type DutyLogEntry, type DutyRun, parseDutyLog } from "./dutyLog";
import {
  calendarScale,
  datePlusDays,
  localDateOf,
  operatorDayScale,
  periodAfter,
  periodsEndingAt,
  type ResolvedWallClock,
  resolveWallClock,
  type UnitScale,
  WallClockRejected,
  type UnitSpan,
} from "./dutyPeriods";
import {
  MAX_PERIOD_COUNT,
  parseDutyRules,
  type ResolvedLocalWindow,
  type ResolvedPair,
  type ResolvedPeriod,
  type ResolvedRule,
  type StatusSet,
  usesOperatorDays,
} from "./dutyRules";
import {
  countEvents,
  countInRange,
  latestPairFrom,
  createRunStore,
  endingAtOrBefore,
  entryHolding,
  firstEndingAfter,
  firstEntryIn,
  firstStartingAtOrAfter,
  firstWhere,
  interruptionResetAt,
  lastAtLeastUntil,
  lastEntryBefore,
  latestAtLeast,
  logStartBefore,
  runEndingAt,
  runIndex,
  runsMatching,
  type RunIndex,
  type RunStore,
  type RunView,
  runsUntil,
  type StatusKey,
  timeInBefore,
  viewRun,
} from "./dutyRunIndex";
import { MIN_EPOCH_NANOSECONDS } from "./epochNanoseconds";
import { isObject } from "./isObject";
import { parseScheduleDisambiguation } from "./operatingSchedule";
import { formatHourDuration } from "./hourDurationString";
import { type ZoneFrame, zoneFrame } from "./zoneFrame";
import { parseDayStartTime } from "./dutyPeriods";

/** Everything one call evaluates its rules against. */
export type DutyContext = {
  entries: readonly DutyLogEntry[];
  frame: ZoneFrame;
  dayStartTime: Temporal.PlainTime | null;
  /** How a day start or local window edge the zone repeats or skips is resolved. */
  disambiguation: Disambiguation;
  scales: Map<string, UnitScale>;
  /** Local window edges already resolved, by local date-time: Temporal resolves each once. */
  wallClocks: Map<string, ResolvedWallClock | null>;
  /**
   * Local window instances already resolved, by window: separate stretches of local dates, each
   * with the span it covers.
   */
  windowInstances: Map<string, WindowInstances[]>;
  /** The whole log and the run index of each status test, built once per call. */
  store: RunStore;
};

/** A duration or a count, before it is written into an outcome. */
type Measure = { duration: bigint } | { count: number };

/**
 * How failed windows of one rule are told apart in a range. `"slide"`: a window that moves with the
 * instant, whose failures are one violation while they follow one another with no passing check
 * between. `"start"`: a count since a reset, whose failures are one violation while they share a
 * key, reported by the worst. `"period"`: one fixed local period, whose failures are one violation,
 * reported by the last check of it, which judges the period complete.
 */
type Grouping = "slide" | "start" | "period";

/** One rule at one instant, in nanoseconds. */
type Evaluation = {
  satisfied: boolean;
  used: Measure | null;
  limit: Measure | null;
  remaining: Measure | null;
  window: UnitSpan | null;
  periodBasis: PeriodBasis | null;
  dueBy: bigint | null;
  resetAt: bigint | null;
  /** How far past its limit a failed rule is, to pick the worst window; unused when it holds. */
  excess: bigint;
  grouping: Grouping;
  /**
   * For `"start"` grouping, what failures of one violation share; the window's start unless the
   * rule says otherwise.
   */
  key?: bigint;
  /**
   * True when time before the log's first entry could change the answer though the window starts
   * inside the log: a rest measured whole that starts with the log. The record does not judge it.
   */
  beforeLog?: boolean;
};

/** A window a call cannot place in Temporal's range. Caught by the public function. */
export class Unrepresentable extends RangeError {}

/**
 * A count as a number, exactly. Past `Number.MAX_SAFE_INTEGER` a number would round it, so the
 * call is refused instead.
 */
function exactCount(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Unrepresentable("a count past the safe integers");
  }
  return Number(value);
}

const duration = (nanoseconds: bigint): Measure => ({
  duration: nanoseconds > 0n ? nanoseconds : 0n,
});
const tally = (value: number): Measure => ({ count: value > 0 ? value : 0 });
const max = (a: bigint, b: bigint) => (a > b ? a : b);
const min = (a: bigint, b: bigint) => (a < b ? a : b);
const length = (run: DutyRun) => run.end - run.start;

/**
 * Read the log, rules and options `evaluateDutyLog` and `dutyViolations` take, all-or-nothing.
 *
 * - `options` must be an object with a valid `timeZone`; `dayStartTime` is optional, but a rule
 *   that counts operator days needs it; `disambiguation` is `"compatible"` when absent. Each
 *   member is read once.
 *
 * @param log candidate duty log
 * @param rules candidate rules
 * @param options candidate `{ timeZone, dayStartTime?, disambiguation? }`
 * @returns the context and resolved rules, or null on invalid input
 */
export function prepareDutyCall(
  log: unknown,
  rules: unknown,
  options: unknown,
): { context: DutyContext; rules: ResolvedRule[] } | null {
  const entries = parseDutyLog(log);
  const resolved = parseDutyRules(rules);

  if (entries === null || resolved === null || !isObject(options)) {
    return null;
  }

  const { timeZone, dayStartTime } = options as {
    timeZone?: unknown;
    dayStartTime?: unknown;
  };
  const disambiguation = parseScheduleDisambiguation(options);
  const frame = zoneFrame(timeZone);
  const time =
    dayStartTime === undefined ? null : parseDayStartTime(dayStartTime);

  if (
    frame === null ||
    disambiguation === null ||
    (dayStartTime !== undefined && time === null) ||
    (time === null && resolved.some(usesOperatorDays))
  ) {
    return null;
  }

  return {
    context: {
      entries,
      frame,
      dayStartTime: time,
      disambiguation,
      scales: new Map(),
      wallClocks: new Map(),
      windowInstances: new Map(),
      store: createRunStore(entries),
    },
    rules: resolved,
  };
}

function scaleFor(
  context: DutyContext,
  unit: Extract<ResolvedPeriod, { kind: "units" }>["unit"],
): UnitScale {
  const known = context.scales.get(unit);

  if (known !== undefined) {
    return known;
  }

  let scale: UnitScale;

  if (unit === "operatorDay") {
    if (context.dayStartTime === null) {
      throw new Unrepresentable("operator days need dayStartTime");
    }
    scale = operatorDayScale(
      context.frame,
      context.dayStartTime,
      context.disambiguation,
    );
  } else {
    scale = calendarScale(context.frame, unit);
  }

  context.scales.set(unit, scale);
  return scale;
}

/**
 * Read a status list a helper takes: an array of strings, `[]` allowed. Each element is read once.
 *
 * @param value candidate status list
 * @returns the statuses, or null when `value` is not an array of strings
 */
export function readStatusList(value: unknown): StatusSet | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const statuses = new Set<string>();
  const count = value.length;

  for (let index = 0; index < count; index++) {
    const status: unknown = value[index];

    if (typeof status !== "string") {
      return null;
    }

    statuses.add(status);
  }

  return statuses;
}

/**
 * Maximal runs of touching entries whose status passes `test`, merged as `mergeIntervals` merges
 * them (CORE-6): touching entries join, and a gap or another status ends a run.
 */
export function runsOf(
  log: readonly DutyLogEntry[],
  test: StatusSet,
): DutyRun[] {
  return runsMatching(log, (status) => test.has(status));
}

/**
 * The parts of ordered, separate runs inside `[from, to)`, empty parts dropped: `clipRuns`, with
 * the runs before `from` skipped by a binary search instead of read one by one.
 */
function runsBetween(
  runs: readonly DutyRun[],
  from: bigint,
  to: bigint,
): DutyRun[] {
  let low = 0;
  let high = runs.length;

  // A binary search over at most 2^32 runs.
  for (let step = 0; step < 33 && low < high; step++) {
    const middle = (low + high) >> 1;

    if ((runs[middle] as DutyRun).end <= from) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  const inside: DutyRun[] = [];

  for (let index = low; index < runs.length; index++) {
    const run = runs[index] as DutyRun;

    if (run.start >= to) {
      break;
    }
    inside.push({ start: max(run.start, from), end: min(run.end, to) });
  }

  return inside;
}

/** The parts of runs inside `[from, to)`, empty parts dropped. */
export function clipRuns(runs: readonly DutyRun[], from: bigint, to: bigint) {
  const clipped: DutyRun[] = [];

  for (const run of runs) {
    const start = max(run.start, from);
    const end = min(run.end, to);

    if (start < end) {
      clipped.push({ start, end });
    }
  }

  return clipped;
}

/** Time in `statuses` inside `[from, to)`. */
export function timeIn(
  log: readonly DutyLogEntry[],
  statuses: StatusSet,
  from: bigint,
  to: bigint,
): bigint {
  let total = 0n;

  for (const entry of log) {
    if (statuses.has(entry.status)) {
      const start = max(entry.start, from);
      const end = min(entry.end, to);
      total += end > start ? end - start : 0n;
    }
  }

  return total;
}

/**
 * The paired rests among runs of rest: two runs in a row, each shorter than `fullRest` and at
 * least `pair.each`, the longer at least `pair.one` and both together at least `pair.combined`.
 *
 * - A run of `fullRest` or more is a rest on its own: it pairs with nothing, and no pair spans it.
 * - A run shorter than `pair.each` is neither half of a pair nor a break between two runs.
 * - Pairs may chain: of runs a, b and c, both (a, b) and (b, c) are returned when both qualify.
 *
 * @param runs runs of rest, in order
 * @param fullRest the length at which a run is a full rest
 * @param pair the three floors
 * @returns the qualifying pairs, in order
 */
export function restPairs(
  runs: readonly DutyRun[],
  fullRest: bigint,
  pair: ResolvedPair,
): { first: DutyRun; second: DutyRun }[] {
  const pairs: { first: DutyRun; second: DutyRun }[] = [];
  let previous: DutyRun | undefined;

  for (const run of runs) {
    const taken = length(run);

    if (taken >= fullRest) {
      previous = undefined;
      continue;
    }

    if (taken < pair.each) {
      continue;
    }

    if (previous !== undefined) {
      const before = length(previous);

      if (max(before, taken) >= pair.one && before + taken >= pair.combined) {
        pairs.push({ first: previous, second: run });
      }
    }

    previous = run;
  }

  return pairs;
}

/**
 * A rule's window at one instant. `rolling` is true when it moves with the instant and overlaps the
 * one before it: an elapsed duration, or more than one local period.
 */
type ResolvedWindow = { span: UnitSpan; basis: PeriodBasis; rolling: boolean };

/** A period repeated `times` over: `times` × its length, or `times` × its count. */
function repeated(period: ResolvedPeriod, times: number): ResolvedPeriod {
  return period.kind === "elapsed"
    ? { kind: "elapsed", length: period.length * BigInt(times) }
    : { ...period, count: period.count * times };
}

/** The window a period names at `at`: sliding for elapsed time, whole periods otherwise. */
function windowOf(
  context: DutyContext,
  period: ResolvedPeriod,
  at: bigint,
  anchor: bigint,
): ResolvedWindow {
  if (period.kind === "elapsed") {
    return {
      span: {
        start: max(at - period.length, MIN_EPOCH_NANOSECONDS),
        end: at,
      },
      basis: "elapsed",
      rolling: true,
    };
  }

  const scale = scaleFor(context, period.unit);
  const span = periodsEndingAt(scale, period.count, anchor);

  if (span === null) {
    throw new Unrepresentable("period outside the instant range");
  }

  return { span, basis: scale.basis, rolling: period.count > 1 };
}

/** The end of the `periods`-th period, the one `from` falls in counting as the first. */
function boundaryAfter(
  context: DutyContext,
  period: ResolvedPeriod,
  periods: number,
  from: bigint,
): bigint {
  if (period.kind === "elapsed") {
    return from + period.length * BigInt(periods);
  }

  const scale = scaleFor(context, period.unit);
  const first = scale.containing(from);
  const last =
    first === null
      ? null
      : periodAfter(scale, first, period.count * periods - 1);

  if (last === null) {
    throw new Unrepresentable("period outside the instant range");
  }

  return last.end;
}

const basisOf = (window: ResolvedWindow): PeriodBasis => window.basis;
const groupingOf = (window: ResolvedWindow): Grouping =>
  window.rolling ? "slide" : "period";

/** A cap: holds while `used` is at most `limit`. */
function capped(
  used: Measure,
  limit: Measure,
  rest: Pick<
    Evaluation,
    "window" | "periodBasis" | "dueBy" | "resetAt" | "grouping"
  >,
): Evaluation {
  const usedValue = "duration" in used ? used.duration : BigInt(used.count);
  const limitValue = "duration" in limit ? limit.duration : BigInt(limit.count);
  const remaining = limitValue - usedValue;

  return {
    satisfied: usedValue <= limitValue,
    used,
    limit,
    remaining:
      "duration" in limit ? duration(remaining) : tally(Number(remaining)),
    excess: usedValue - limitValue,
    ...rest,
  };
}

/** A floor: holds while `used` is at least `limit`, or `met` says otherwise. */
function floored(
  used: bigint,
  limit: bigint,
  met: boolean,
  rest: Pick<
    Evaluation,
    "window" | "periodBasis" | "dueBy" | "resetAt" | "grouping"
  >,
): Evaluation {
  return {
    satisfied: met,
    used: duration(used),
    limit: duration(limit),
    remaining: duration(limit - used),
    excess: limit - used,
    ...rest,
  };
}

/** How a list of rest runs measures against a `restRequirement`'s floors. */
function restChecks(
  rule: Extract<ResolvedRule, { kind: "restRequirement" }>,
  lengths: readonly bigint[],
) {
  const sorted = [...lengths].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
  const longest = sorted[0] ?? 0n;
  const checks: { used: bigint; limit: bigint }[] = [];
  let counted = sorted.reduce((sum, value) => sum + value, 0n);

  if (rule.composition !== null) {
    const { maxPeriods, longestAtLeast, othersAtLeast } = rule.composition;
    const others = sorted
      .slice(1)
      .filter((value) => value >= othersAtLeast)
      .slice(0, maxPeriods - 1);
    counted = min(
      counted,
      others.reduce((sum, value) => sum + value, longest),
    );
    checks.push({ used: longest, limit: longestAtLeast });
  }

  if (rule.composite !== null) {
    const { consecutive, additional, blockMinimum } = rule.composite;
    const blocks = sorted
      .slice(1)
      .filter((value) => value >= blockMinimum)
      .reduce((sum, value) => sum + value, 0n);
    checks.push({ used: longest, limit: consecutive });
    checks.push({
      used: max(longest - consecutive, 0n) + blocks,
      limit: additional,
    });
    counted = min(counted, longest + blocks);
  }

  checks.push({ used: counted, limit: rule.minimum });

  const failing = checks.find((check) => check.used < check.limit);
  return {
    met: failing === undefined,
    failing,
    // The last check is always the minimum: rest counted against `minimum`.
    total: checks[checks.length - 1] as (typeof checks)[number],
  };
}

/** Rest runs with rest added from `at` to `end`, joined to a run that reaches `at`. */
function withRestUntil(runs: readonly DutyRun[], at: bigint, end: bigint) {
  const last = runs[runs.length - 1];

  return last !== undefined && last.end === at
    ? [...runs.slice(0, -1), { start: last.start, end }]
    : [...runs, { start: at, end }];
}

/** `resolveWallClock` under the call's policy, each local date-time resolved once per call. */
function wallClockOf(
  context: DutyContext,
  date: Temporal.PlainDate,
  time: Temporal.PlainTime,
): ResolvedWallClock | null {
  const key = `${date.toString()}T${time.toString()}`;
  const known = context.wallClocks.get(key);

  if (known !== undefined) {
    return known;
  }

  const resolved = resolveWallClock(
    context.frame,
    date,
    time,
    context.disambiguation,
  );
  context.wallClocks.set(key, resolved);
  return resolved;
}

/**
 * The whole local windows inside `[from, to)` in the reference zone, their edges resolved under
 * the call's `disambiguation`.
 *
 * - `strict`: under `"reject"`, a window with a repeated or skipped edge that reaches `[from, to)`
 *   throws `WallClockRejected`. Without it, such an edge is read `"compatible"`: for rest that is
 *   only supposed (the best case of a window not yet over), or for finding candidate instants.
 */
function localWindowsIn(
  context: DutyContext,
  window: ResolvedLocalWindow,
  from: bigint,
  to: bigint,
  strict: boolean,
): DutyRun[] {
  const found: DutyRun[] = [];
  const instances = windowInstances(context, window, from, to);
  // Every policy maps wall times to instants without reversing them, so the instances are in
  // order by start and by end: skip to the first that ends after `from`.
  let low = 0;
  let high = instances.length;

  // A binary search over at most 2^32 instances.
  for (let step = 0; step < 33 && low < high; step++) {
    const middle = (low + high) >> 1;

    if ((instances[middle] as WindowInstance).end <= from) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  for (let index = low; index < instances.length; index++) {
    const instance = instances[index] as WindowInstance;

    if (instance.start >= to) {
      break;
    }

    // Under "reject", a window with a repeated or skipped edge that reaches the run is refused.
    if (strict && instance.rejected && instance.end > from) {
      throw new WallClockRejected("a local window the zone repeats or skips");
    }

    if (
      instance.start < instance.end &&
      instance.start >= from &&
      instance.end <= to
    ) {
      found.push({ start: instance.start, end: instance.end });
    }
  }

  return found;
}

/** One local window on one local date, resolved; `rejected` as `resolveWallClock` reports it. */
type WindowInstance = { start: bigint; end: bigint; rejected: boolean };

/** The instances of one local window on the local dates `first` to `last`, covering `[from, to)`. */
type WindowInstances = {
  from: bigint;
  to: bigint;
  first: Temporal.PlainDate;
  last: Temporal.PlainDate;
  instances: WindowInstance[];
};

/** Two days: how far either side of a request the window instances are resolved and kept. */
const WINDOW_MARGIN = 172_800_000_000_000n;

/** The instances of a local window on the dates `first` to `last`, in date order. */
function instancesOn(
  context: DutyContext,
  window: ResolvedLocalWindow,
  first: Temporal.PlainDate,
  last: Temporal.PlainDate,
): WindowInstance[] {
  const instances: WindowInstance[] = [];
  let date: Temporal.PlainDate | null = first;

  for (
    let step = 0;
    date !== null && Temporal.PlainDate.compare(date, last) <= 0;
    step++
  ) {
    if (step > 2 * MAX_PERIOD_COUNT) {
      throw new Unrepresentable("too many local windows");
    }

    const next = datePlusDays(date, 1);
    const start = wallClockOf(context, date, window.from);
    const end =
      window.wraps && next === null
        ? null
        : wallClockOf(
            context,
            window.wraps ? (next as Temporal.PlainDate) : date,
            window.to,
          );

    if (start !== null && end !== null) {
      instances.push({
        start: start.at,
        end: end.at,
        rejected: start.rejected || end.rejected,
      });
    }

    date = next;
  }

  return instances;
}

/** How close a request must be to a stretch already resolved to extend it: thirty days. */
const WINDOW_JOIN = 2_592_000_000_000_000n;

/**
 * Every instance of a local window on the local dates around `[from, to)`, resolved once per call
 * and kept, so each later evaluation only filters them.
 *
 * - A request near a stretch of dates already kept resolves only the dates it adds, so a scan
 *   that moves along the log resolves each date once. A request far from every stretch starts a
 *   stretch of its own: the dates between two far-apart rests are never resolved.
 * - One request may need at most `2 × MAX_PERIOD_COUNT` dates; past that it throws
 *   `Unrepresentable`. What is kept from earlier requests does not count against it.
 */
function windowInstances(
  context: DutyContext,
  window: ResolvedLocalWindow,
  from: bigint,
  to: bigint,
): WindowInstance[] {
  const key = `${window.from.toString()}-${window.to.toString()}`;
  const stretches = context.windowInstances.get(key) ?? [];
  const covering = stretches.find(
    (stretch) => stretch.from <= from && stretch.to >= to,
  );

  if (covering !== undefined) {
    return covering.instances;
  }

  const wantedFrom = from - WINDOW_MARGIN;
  const wantedTo = to + WINDOW_MARGIN;
  const wanted = datePlusDays(localDateOf(context.frame, wantedFrom), -1);
  const until = localDateOf(context.frame, wantedTo - 1n);

  if (
    wanted === null ||
    wanted.until(until, { largestUnit: "day" }).days > 2 * MAX_PERIOD_COUNT
  ) {
    throw new Unrepresentable("too many local windows");
  }

  const known = stretches.find(
    (stretch) =>
      stretch.from - WINDOW_JOIN <= wantedTo &&
      stretch.to + WINDOW_JOIN >= wantedFrom,
  );
  const spanFrom =
    known === undefined ? wantedFrom : min(known.from, wantedFrom);
  const spanTo = known === undefined ? wantedTo : max(known.to, wantedTo);
  // A fall-back can put an earlier instant on a later local date, so the dates kept stay a
  // superset of the dates wanted.
  const first =
    known !== undefined && Temporal.PlainDate.compare(known.first, wanted) < 0
      ? known.first
      : wanted;
  const last =
    known !== undefined && Temporal.PlainDate.compare(known.last, until) > 0
      ? known.last
      : until;
  let instances: WindowInstance[];

  if (known === undefined) {
    instances = instancesOn(context, window, first, last);
  } else {
    const before = datePlusDays(known.first, -1);
    const after = datePlusDays(known.last, 1);
    instances = [
      ...(before !== null && Temporal.PlainDate.compare(first, before) <= 0
        ? instancesOn(context, window, first, before)
        : []),
      ...known.instances,
      ...(after !== null && Temporal.PlainDate.compare(after, last) <= 0
        ? instancesOn(context, window, after, last)
        : []),
    ];
  }

  const stretch = { from: spanFrom, to: spanTo, first, last, instances };
  context.windowInstances.set(key, [
    ...stretches.filter((other) => other !== known),
    stretch,
  ]);
  return instances;
}

/** How many free periods one run of rest holds. */
function freePeriodsIn(
  context: DutyContext,
  rule: Extract<ResolvedRule, { kind: "freePeriod" }>,
  run: DutyRun,
  strict: boolean,
): bigint {
  if (rule.containing === null) {
    return length(run) / rule.minimum;
  }

  // Greedy, earliest end first: each free period ends as soon as it is long enough and holds
  // enough windows, which leaves the most room for the next.
  const { window, count } = rule.containing;
  const instances = localWindowsIn(context, window, run.start, run.end, strict);
  let cursor = run.start;
  let first = 0;
  let found = 0;

  // Each free period takes at least one window, so there are no more of them than windows. The
  // cursor only moves on, so the first window after it is found by moving on too.
  for (let step = 0; step <= instances.length; step++) {
    for (; first < instances.length; first++) {
      if ((instances[first] as DutyRun).start >= cursor) {
        break;
      }
    }

    const last = instances[first + count - 1];
    const end =
      last === undefined ? null : max(cursor + rule.minimum, last.end);

    if (end === null || end > run.end) {
      break;
    }

    found++;
    cursor = end;
  }

  return BigInt(found);
}

function evaluateFreePeriod(
  context: DutyContext,
  rule: Extract<ResolvedRule, { kind: "freePeriod" }>,
  at: bigint,
  anchor: bigint,
): Evaluation {
  const window = windowOf(context, rule.within, at, anchor);
  // Every count below ends at or before `at`, so the runs of the whole log, cut to the count's
  // span, are the runs of the log as it stands at `at`.
  const rests = runIndex(context.store, rule.restStatuses).runs;
  const countIn = (from: bigint, to: bigint, extendTo?: bigint) => {
    const inside = runsBetween(rests, from, to);
    const runs =
      extendTo === undefined ? inside : withRestUntil(inside, at, extendTo);
    // Rest supposed from `at` is not the log, so "reject" does not refuse its windows.
    const strict = extendTo === undefined;
    return runs.reduce(
      (sum, run) => sum + freePeriodsIn(context, rule, run, strict),
      0n,
    );
  };
  // `atLeast` is a safe integer, so a count capped there compares with it as the count does.
  const enough = (count: bigint) => count >= BigInt(rule.atLeast);

  const { span } = window;
  const found = exactCount(countIn(span.start, min(span.end, at)));
  const unfinished = span.end > at;
  const met =
    found >= rule.atLeast ||
    (unfinished && enough(countIn(span.start, at, span.end)));
  let dueBy: bigint | null = null;

  if (found >= rule.atLeast && rule.atLeast > 0) {
    if (rule.within.kind === "elapsed") {
      // With no rest after `at`, the count of a window ending at t only falls as t grows, and
      // a window starting at `at` holds none: find the last t that still holds enough.
      const windowLength = rule.within.length;
      let low = at;
      let high = at + windowLength;

      // A Temporal duration is under 2^53 seconds, so under 2^83 nanoseconds: 90 halvings
      // always settle it.
      for (let step = 0; step < 90 && high - low > 1n; step++) {
        const middle = (low + high) / 2n;
        if (enough(countIn(middle - windowLength, at))) {
          low = middle;
        } else {
          high = middle;
        }
      }

      dueBy = low;
    } else {
      // The window k periods later runs from the k-th period of this one, for `count` periods.
      // Its count only falls as k grows, and k = count holds none, so search for the first short.
      const scale = scaleFor(context, rule.within.unit);
      const count = rule.within.count;
      const first = scale.containing(span.start);
      const unitAt = (index: number): UnitSpan => {
        // The scale keeps the periods it walks, so the search below walks each one once.
        const found = first === null ? null : periodAfter(scale, first, index);

        if (found === null) {
          throw new Unrepresentable("period outside the instant range");
        }
        return found;
      };

      let low = 1;
      let high = count;

      for (let step = 0; step < 32 && low < high; step++) {
        const middle = (low + high) >> 1;
        if (!enough(countIn(unitAt(middle).start, at))) {
          high = middle;
        } else {
          low = middle + 1;
        }
      }

      dueBy = unitAt(low + count - 1).end;
    }
  } else if (met) {
    dueBy = span.end;
  }

  return {
    satisfied: met,
    used: tally(found),
    limit: tally(rule.atLeast),
    remaining: tally(rule.atLeast - found),
    window: span,
    periodBasis: basisOf(window),
    dueBy,
    resetAt: null,
    excess: BigInt(rule.atLeast - found),
    grouping: groupingOf(window),
  };
}

/**
 * The stretches without rest in the log as it stood at `at`: each runs from the end of one rest to
 * the start of the next, the last to `at` (or nowhere, when a rest reaches `at`). The log's first
 * entry starts one too, as a rest ending there would: time before the log is unknown, but the work
 * logged before the first rest is a stretch without rest like any other.
 */
function restGaps(rests: RunView, logStart: bigint | undefined, at: bigint) {
  const taken = rests.count;
  const resting = rests.last !== undefined && rests.last.end === at;
  const prepended =
    logStart !== undefined &&
    (taken === 0 || viewRun(rests, 0).start !== logStart);
  const startAt = (gap: number): bigint =>
    prepended
      ? gap === 0
        ? (logStart as bigint)
        : viewRun(rests, gap - 1).end
      : viewRun(rests, gap).end;
  const endAt = (gap: number): bigint => {
    const next = prepended ? gap : gap + 1;

    return next < taken
      ? viewRun(rests, next).start
      : resting
        ? startAt(gap)
        : at;
  };

  return {
    count: prepended ? taken + 1 : taken,
    resting,
    startAt,
    endAt,
  };
}

/**
 * The longest stretch without rest touching `[from, to)`, found from the first that ends after
 * `from`.
 */
function widestGap(
  gaps: ReturnType<typeof restGaps>,
  from: bigint,
  to: bigint,
): bigint {
  let widest = 0n;

  for (
    let gap = firstWhere(gaps.count, (position) => gaps.endAt(position) > from);
    gap < gaps.count && gaps.startAt(gap) < to;
    gap++
  ) {
    widest = max(widest, gaps.endAt(gap) - gaps.startAt(gap));
  }

  return widest;
}

/** The widest stretch without rest in `[from, upper)` at `at`, and when the next rest falls due. */
function widestRestGap(
  context: DutyContext,
  index: RunIndex,
  at: bigint,
  from: bigint,
  upper: bigint,
  maxGap: bigint,
): { widest: bigint; dueBy: bigint | null } {
  const gaps = restGaps(
    runsUntil(index, at),
    logStartBefore(context.store, at),
    at,
  );

  return {
    widest: widestGap(gaps, from, upper),
    dueBy:
      gaps.count > 0 && !gaps.resting
        ? gaps.startAt(gaps.count - 1) + maxGap
        : null,
  };
}

function evaluateRestRequirement(
  context: DutyContext,
  rule: Extract<ResolvedRule, { kind: "restRequirement" }>,
  at: bigint,
  anchor: bigint,
): Evaluation {
  const window = windowOf(context, rule.per, at, anchor);
  const { span } = window;
  const index = runIndex(context.store, rule.restStatuses);
  const upper = min(span.end, at);
  // The count ends at or before `at`, so the runs of the whole log, cut to it, are the runs of
  // the log as it stands at `at`.
  const inside =
    span.start < upper ? runsBetween(index.runs, span.start, upper) : [];
  const actual = restChecks(rule, inside.map(length));
  const met =
    actual.met ||
    (span.end > at &&
      restChecks(rule, withRestUntil(inside, at, span.end).map(length)).met);
  // A failed rule shows the floor it failed; one that holds, or can still be met before its
  // window ends, shows the rest counted so far against the minimum.
  const shown = (met ? undefined : actual.failing) ?? actual.total;
  const rest = {
    window: span,
    periodBasis: basisOf(window),
    resetAt: null,
    grouping: groupingOf(window),
  };

  if (rule.maxGap !== null) {
    const { widest, dueBy } = widestRestGap(
      context,
      index,
      at,
      span.start,
      upper,
      rule.maxGap,
    );

    if (widest > rule.maxGap) {
      return {
        satisfied: false,
        used: duration(widest),
        limit: duration(rule.maxGap),
        remaining: duration(0n),
        excess: widest - rule.maxGap,
        dueBy,
        ...rest,
      };
    }

    return floored(shown.used, shown.limit, met, {
      ...rest,
      dueBy,
    });
  }

  return floored(shown.used, shown.limit, met, {
    ...rest,
    dueBy: null,
  });
}

/** What `evaluateRestBeforeDuty` has worked out before it judges the rest by either rule. */
type DutyStart = {
  rests: RunView;
  dutyStart: bigint;
  onDuty: boolean;
  logStart: bigint;
};

/** The rest right before a duty, measured whole, against the duty before it (`orFactor`). */
function restBeforeDutyScaled(
  rule: Extract<ResolvedRule, { kind: "restBeforeDuty" }>,
  orFactor: NonNullable<
    Extract<ResolvedRule, { kind: "restBeforeDuty" }>["orFactor"]
  >,
  { rests, dutyStart, onDuty, logStart }: DutyStart,
): Evaluation {
  // The rest judged is the one right before the duty, measured whole, against the duty it
  // ends: from the end of the last rest of at least `minimum` before it, breaks included, to
  // where it starts. A duty between an earlier rest and this one is never skipped, and more
  // rest before the duty only lengthens the rest or shortens the duty before it.
  const rest = runEndingAt(rests, dutyStart);
  const restStart = rest?.start ?? dutyStart;
  const fullRest = latestAtLeast(
    rests,
    endingAtOrBefore(rests, restStart),
    rule.minimum,
  );
  const dutyFrom = fullRest?.end ?? min(logStart, restStart);
  const previousDuty = restStart - dutyFrom;
  const { numerator, denominator } = orFactor.k;
  // k × the duty, rounded up to the nanosecond, exactly.
  const scaled = (previousDuty * numerator + denominator - 1n) / denominator;
  const limit = max(rule.minimum, max(scaled, orFactor.floor));
  const used = rest === undefined ? 0n : length(rest);

  return {
    ...floored(used, limit, !onDuty || used >= limit, {
      window: { start: dutyFrom, end: dutyStart },
      periodBasis: "elapsed",
      dueBy: null,
      resetAt: null,
      grouping: "start",
    }),
    // A rest that starts with the log, or a duty with none logged before it, may have more
    // rest before the log: the record does not judge it.
    beforeLog: restStart <= logStart,
    key: restStart,
  };
}

/** The longest run of rest inside `[windowStart, dutyStart)`, the latest on a tie. */
function longestRestInside(
  rests: RunView,
  windowStart: bigint,
  dutyStart: bigint,
): { run: DutyRun; inside: bigint } | undefined {
  // Only the runs reaching into the window are read, and dutyStart is at most `at`, so the cut
  // last run reads as it does whole.
  let rest: { run: DutyRun; inside: bigint } | undefined;

  for (
    let position = firstEndingAfter(rests, windowStart);
    position < rests.count;
    position++
  ) {
    const run = viewRun(rests, position);

    if (run.start >= dutyStart) {
      break;
    }

    const inside = min(run.end, dutyStart) - max(run.start, windowStart);

    if (inside > 0n && (rest === undefined || inside >= rest.inside)) {
      rest = { run, inside };
    }
  }

  return rest;
}

/** The rest before a duty: the longest inside the window, against the minimum. */
function restBeforeDutyWithin(
  rule: Extract<ResolvedRule, { kind: "restBeforeDuty" }>,
  { rests, dutyStart, onDuty }: DutyStart,
): Evaluation {
  const windowStart = max(dutyStart - rule.within, MIN_EPOCH_NANOSECONDS);
  const rest = longestRestInside(rests, windowStart, dutyStart);
  const used = rest?.inside ?? 0n;

  return {
    ...floored(used, rule.minimum, !onDuty || used >= rule.minimum, {
      window: { start: windowStart, end: dutyStart },
      periodBasis: "elapsed",
      dueBy: null,
      resetAt: null,
      grouping: "start",
    }),
    // Every duty start after one short rest is the same failure: the record lists it once.
    key: rest?.run.start ?? windowStart,
  };
}

function evaluateRestBeforeDuty(
  context: DutyContext,
  rule: Extract<ResolvedRule, { kind: "restBeforeDuty" }>,
  at: bigint,
): Evaluation {
  const { store } = context;
  const rests = runsUntil(runIndex(store, rule.restStatuses), at);
  const last = lastEntryBefore(store, at);
  const onDuty =
    last !== undefined &&
    last.end === at &&
    !rule.restStatuses.has(last.status);
  // On duty, the duty started where the run outside rest reaching `at` began; resting, a duty
  // starting now is the one to be ready for.
  const dutyStart = onDuty
    ? (
        runsUntil(runIndex(store, { not: rule.restStatuses }), at)
          .last as DutyRun
      ).start
    : at;
  const started = {
    rests,
    dutyStart,
    onDuty,
    logStart: logStartBefore(store, at) ?? at,
  };

  return rule.orFactor === null
    ? restBeforeDutyWithin(rule, started)
    : restBeforeDutyScaled(rule, rule.orFactor, started);
}

function evaluateRule(
  context: DutyContext,
  rule: ResolvedRule,
  at: bigint,
  anchor: bigint,
): Evaluation {
  // A free period reads only runs of rest, kept for the whole call, not the log cut at `at`.
  if (rule.kind === "freePeriod") {
    return evaluateFreePeriod(context, rule, at, anchor);
  }

  // The log as it stands at `at` is the whole log read up to `at`: no copy is made.
  const { store } = context;
  const first = logStartBefore(store, at) ?? at;
  const viewOf = (test: StatusKey) => runsUntil(runIndex(store, test), at);
  const timeOf = (test: StatusKey, from: bigint, to: bigint) =>
    timeInBefore(runIndex(store, test), from, to, at);

  switch (rule.kind) {
    case "cumulativeCap": {
      const reset = lastAtLeastUntil(
        viewOf(rule.since.statuses),
        rule.since.consecutive,
      );
      const from = reset?.end ?? first;

      return capped(
        duration(timeOf(rule.statuses, from, at)),
        duration(rule.cap),
        {
          window: { start: from, end: at },
          periodBasis: null,
          dueBy: null,
          resetAt: reset?.end ?? null,
          grouping: "start",
        },
      );
    }

    case "elapsedWindow": {
      const rests = viewOf(rule.since.statuses);
      const reset = lastAtLeastUntil(rests, rule.since.consecutive);
      const after = reset?.end ?? null;
      const opener = firstEntryIn(store, rule.startStatuses, after, at);

      if (opener === undefined) {
        return {
          satisfied: true,
          used: duration(0n),
          limit: duration(rule.length),
          remaining: duration(rule.length),
          window: null,
          periodBasis: null,
          dueBy: null,
          resetAt: after,
          excess: 0n,
          grouping: "start",
        };
      }

      let opensAt = opener.start;
      let second: DutyRun | undefined;

      if (rule.exclude !== null) {
        const latest = latestPairFrom(
          rests,
          firstStartingAtOrAfter(rests, opener.start),
          rule.since.consecutive,
          rule.exclude,
        );

        if (latest !== undefined) {
          opensAt = latest.first.end;
          second = latest.second;
        }
      }

      // The window's time stops while the second rest of a pair lasts, so a second rest that
      // starts before the close moves it by its whole length, and one that starts after the close
      // moves nothing. The extension and the second rest each lengthen the window, so either one
      // can bring the other inside it: apply each once, as soon as it falls inside.
      let closesAt = opensAt + rule.length;
      let limit = rule.length;
      let excluded = 0n;
      let extended = false;

      for (let pass = 0; pass < 2; pass++) {
        if (
          excluded === 0n &&
          second !== undefined &&
          second.start < closesAt
        ) {
          excluded = length(second);
          closesAt += excluded;
        }

        if (
          !extended &&
          rule.extension !== null &&
          opener.start <= rule.extension.from &&
          rule.extension.from < closesAt
        ) {
          extended = true;
          closesAt += rule.extension.by;
          limit += rule.extension.by;
        }
      }

      const late = timeOf(rule.restrictedStatuses, closesAt, at);

      return {
        satisfied: late === 0n,
        used: duration(at - opensAt - excluded),
        limit: duration(limit),
        remaining: duration(closesAt - at),
        window: { start: opensAt, end: closesAt },
        periodBasis: "elapsed",
        dueBy: closesAt,
        resetAt: after,
        excess: late,
        grouping: "start",
      };
    }

    case "requiredInterruption": {
      const breaks = viewOf({
        not: rule.countedStatuses,
        within: rule.outsideStatuses,
      });
      const resetAt = interruptionResetAt(
        breaks,
        rule.minimum,
        rule.orderedSplit,
      );
      const from = resetAt ?? first;

      return capped(
        duration(timeOf(rule.countedStatuses, from, at)),
        duration(rule.after),
        {
          window: { start: from, end: at },
          periodBasis: null,
          dueBy: null,
          resetAt,
          grouping: "start",
        },
      );
    }

    case "rollingCap": {
      const window = windowOf(context, rule.window, at, anchor);
      const reset =
        rule.reset === null
          ? undefined
          : lastAtLeastUntil(
              viewOf(rule.reset.statuses),
              rule.reset.consecutive,
            );
      const from =
        reset !== undefined && reset.end > window.span.start
          ? reset.end
          : window.span.start;
      const to = min(window.span.end, at);
      let used = timeOf(rule.statuses, from, to);
      let limit = rule.cap;

      if (rule.precondition !== null) {
        const { restStatuses, minimum, beforeHours } = rule.precondition;
        // `to` is at most `at`, so the runs of the whole log, cut to it, are the log's.
        const rest = (
          from < to
            ? runsBetween(runIndex(store, restStatuses).runs, from, to)
            : []
        ).find((run) => length(run) >= minimum);
        const before =
          rest === undefined ? used : timeOf(rule.statuses, from, rest.start);

        if (rest === undefined || before > beforeHours) {
          limit = beforeHours;
          used = before;
        }
      }

      return capped(duration(used), duration(limit), {
        window: { start: from, end: window.span.end },
        periodBasis: basisOf(window),
        dueBy: null,
        resetAt: reset?.end ?? null,
        grouping: groupingOf(window),
      });
    }

    case "fixedPeriodCap": {
      const window = windowOf(
        context,
        repeated(rule.period, rule.adjacent),
        at,
        anchor,
      );
      const total = timeOf(
        rule.statuses,
        window.span.start,
        min(window.span.end, at),
      );
      const rest = {
        window: window.span,
        periodBasis: basisOf(window),
        dueBy: null,
        resetAt: null,
        grouping: groupingOf(window),
      };

      if (!rule.average) {
        return capped(duration(total), duration(rule.cap), rest);
      }

      const periods = BigInt(rule.adjacent);
      const allowed = rule.cap * periods;

      return {
        satisfied: total <= allowed,
        used: duration((total + periods - 1n) / periods),
        limit: duration(rule.cap),
        remaining: duration(allowed - total),
        excess: total - allowed,
        ...rest,
      };
    }

    case "restRequirement":
      return evaluateRestRequirement(context, rule, at, anchor);

    case "restBeforeDuty":
      return evaluateRestBeforeDuty(context, rule, at);

    case "quota": {
      const continuing = entryHolding(store, at);
      const running =
        continuing !== undefined && rule.statuses.has(continuing.status);
      const runs = viewOf(rule.statuses);
      const sizes = { minimum: rule.minimum, maximum: rule.maximum };
      // A run going on at `at` is not an event yet.
      const skipEndingAt = running ? at : null;

      if ("every" in rule.reset) {
        const window = windowOf(context, rule.reset.every, at, anchor);
        const to = min(window.span.end, at);
        const found = countEvents(
          runs,
          sizes,
          { from: window.span.start, to },
          skipEndingAt,
        );

        return capped(tally(found), tally(rule.count), {
          window: window.span,
          periodBasis: basisOf(window),
          dueBy: null,
          resetAt: null,
          grouping: groupingOf(window),
        });
      }

      const reset = lastAtLeastUntil(
        viewOf(rule.reset.statuses),
        rule.reset.consecutive,
      );
      const from = reset?.end ?? first;

      return capped(
        tally(countEvents(runs, sizes, { from, to: null }, skipEndingAt)),
        tally(rule.count),
        {
          window: { start: from, end: at },
          periodBasis: null,
          dueBy: null,
          resetAt: reset?.end ?? null,
          grouping: "start",
        },
      );
    }

    case "dueBy": {
      const events = viewOf(rule.statuses);
      const event = lastAtLeastUntil(events, rule.minimum);
      const reset =
        rule.reset === null
          ? undefined
          : lastAtLeastUntil(
              viewOf(rule.reset.statuses),
              rule.reset.consecutive,
            );
      const clock =
        event === undefined
          ? (reset?.end ?? null)
          : reset === undefined
            ? event.end
            : max(event.end, reset.end);
      const from = clock ?? first;
      const due = boundaryAfter(context, rule.period, rule.periods, from);
      const latest = events.last;
      const pending =
        latest !== undefined && latest.end === at && latest.start <= due;

      return {
        satisfied: at <= due || pending,
        used: duration(at - from),
        limit: duration(due - from),
        remaining: duration(due - at),
        window: { start: from, end: due },
        periodBasis:
          rule.period.kind === "elapsed"
            ? "elapsed"
            : scaleFor(context, rule.period.unit).basis,
        dueBy: due,
        resetAt: clock,
        excess: at - due,
        grouping: "start",
      };
    }

    case "pattern": {
      const window = windowOf(
        context,
        repeated(rule.period, rule.lookback),
        at,
        anchor,
      );
      const { span } = window;
      const to = min(span.end, at);
      const unfinished = span.end > at;
      const counts = new Map<string, { found: number; best: number }>();

      for (const named of rule.classes) {
        const runs = viewOf(named.statuses);
        const qualifies = (run: DutyRun) =>
          run.start >= span.start &&
          run.start < to &&
          length(run) >= named.minimum;
        const found = countEvents(
          runs,
          { minimum: named.minimum, maximum: null },
          { from: span.start, to },
          null,
        );
        const last = runs.last;
        let best = found;

        if (unfinished) {
          // A run counts in the window it starts in, measured whole, so the most the window can
          // still gain is the runs that can start before it ends, each `minimum` long before the
          // next. A run still going at `at` that started inside the window qualifies by going on;
          // one that started before it must end first.
          let firstStart = at;

          if (
            last !== undefined &&
            last.end === at &&
            !qualifies(last) &&
            last.start >= span.start
          ) {
            best += 1;
            firstStart = last.start + named.minimum;
          }

          if (firstStart < span.end) {
            const room = span.end - firstStart;
            // `best` is only held to `atLeast`, a safe integer, so a count past the safe
            // integers is capped there without changing an answer.
            best += Number(
              min(
                (room + named.minimum - 1n) / named.minimum,
                BigInt(Number.MAX_SAFE_INTEGER),
              ),
            );
          }
        }

        counts.set(named.label, { found, best });
      }

      const slack = rule.require.map((required) => {
        const tallied = counts.get(required.label) as {
          found: number;
          best: number;
        };
        return {
          ...required,
          found: tallied.found,
          actual: tallied.found - required.atLeast,
          best: tallied.best - required.atLeast,
        };
      });
      const tightest = slack.reduce((worst, item) =>
        item.actual < worst.actual ? item : worst,
      );
      const met =
        slack.every((item) => item.actual >= 0) ||
        (unfinished && slack.every((item) => item.best >= 0));

      return {
        satisfied: met,
        used: tally(tightest.found),
        limit: tally(tightest.atLeast),
        remaining: tally(-tightest.actual),
        window: span,
        periodBasis: basisOf(window),
        dueBy: null,
        resetAt: null,
        excess: BigInt(-tightest.actual),
        grouping: groupingOf(window),
      };
    }

    case "occurrenceCap": {
      const scale = scaleFor(context, rule.per.unit);
      const runs = viewOf(rule.statuses);
      const blocks: UnitSpan[] = [];
      let blockAnchor = anchor;

      for (let index = 0; index < rule.lookback; index++) {
        const block = periodsEndingAt(scale, rule.per.count, blockAnchor);

        if (block === null) {
          throw new Unrepresentable("period outside the instant range");
        }

        blocks.push(block);
        blockAnchor = block.start - 1n;
      }

      const occupied = blocks.filter((block) => {
        const to = min(block.end, at);
        // The first run that can count: starting in the block, or ending after it starts.
        const position = rule.byInitiationDate
          ? firstStartingAtOrAfter(runs, block.start)
          : firstEndingAfter(runs, block.start);

        return position < runs.count && viewRun(runs, position).start < to;
      }).length;
      const earliest = blocks[blocks.length - 1] as UnitSpan;
      const latest = blocks[0] as UnitSpan;

      return capped(tally(occupied), tally(rule.maximum), {
        window: { start: earliest.start, end: latest.end },
        periodBasis: scale.basis,
        dueBy: null,
        resetAt: null,
        grouping: rule.lookback * rule.per.count > 1 ? "slide" : "period",
      });
    }

    case "usageLookback": {
      const window = windowOf(context, rule.notWithin, at, anchor);
      const reset = lastAtLeastUntil(
        viewOf(rule.reset.statuses),
        rule.reset.consecutive,
      );
      const from =
        reset !== undefined && reset.end > window.span.start
          ? reset.end
          : window.span.start;
      // A use is an instant, and each window holds it once. An elapsed window runs up to and
      // including the use being made at `at`, so one exactly its length earlier is outside it; a
      // window of local periods holds only its own, so one on its end is the next's.
      const found = countInRange(
        rule.uses,
        rule.notWithin.kind === "elapsed"
          ? max(from, at - rule.notWithin.length + 1n)
          : from,
        rule.notWithin.kind === "elapsed"
          ? at + 1n
          : min(at + 1n, window.span.end),
      );

      return capped(tally(found), tally(1), {
        window: { start: from, end: window.span.end },
        periodBasis: basisOf(window),
        dueBy: null,
        resetAt: reset?.end ?? null,
        grouping: groupingOf(window),
      });
    }
  }
}

const instantText = (nanoseconds: bigint) =>
  Temporal.Instant.fromEpochNanoseconds(nanoseconds).toString();

function measureText(measure: Measure | null): string | number | null {
  if (measure === null) {
    return null;
  }
  if (!("duration" in measure)) {
    return measure.count;
  }

  const text = formatHourDuration(measure.duration);

  // A requirement `orFactor` scales can pass the longest duration Temporal holds.
  if (text === "") {
    throw new Unrepresentable("a duration past Temporal's range");
  }

  return text;
}

function spanText(span: UnitSpan): Interval {
  return { start: instantText(span.start), end: instantText(span.end) };
}

/**
 * Evaluate every rule at one instant.
 *
 * @param context the call's context
 * @param rules the resolved rules
 * @param at the instant, epoch nanoseconds
 * @returns one outcome per rule, in order
 */
export function evaluateDutyRules(
  context: DutyContext,
  rules: readonly ResolvedRule[],
  at: bigint,
): RuleOutcome[] {
  return rules.map((rule) => {
    // The log is read up to `at`, so its local periods are the ones holding the instant before:
    // at a boundary, the period just ended is judged, and a roster ending there is checked whole.
    const evaluation = evaluateRule(context, rule, at, at - 1n);

    return {
      label: rule.label,
      kind: rule.kind,
      severity: rule.severity,
      satisfied: evaluation.satisfied,
      used: measureText(evaluation.used),
      limit: measureText(evaluation.limit),
      remaining: measureText(evaluation.remaining),
      window: evaluation.window === null ? null : spanText(evaluation.window),
      periodBasis: evaluation.periodBasis,
      dueBy: evaluation.dueBy === null ? null : instantText(evaluation.dueBy),
      resetAt:
        evaluation.resetAt === null ? null : instantText(evaluation.resetAt),
    };
  });
}

/** The elapsed lengths a rule's window slides by, for the candidate instants of a range. */
function slideLengths(rule: ResolvedRule): bigint[] {
  const periods: ResolvedPeriod[] = [];

  switch (rule.kind) {
    case "rollingCap":
      periods.push(rule.window);
      break;
    case "restRequirement":
      periods.push(rule.per);
      break;
    case "freePeriod":
      periods.push(rule.within);
      break;
    case "quota":
      if ("every" in rule.reset) {
        periods.push(rule.reset.every);
      }
      break;
    case "pattern":
      periods.push(repeated(rule.period, rule.lookback));
      break;
    case "usageLookback":
      periods.push(rule.notWithin);
      break;
    default:
      break;
  }

  return periods.flatMap((period) =>
    period.kind === "elapsed" ? [period.length] : [],
  );
}

/** The local units a rule counts in, whose boundaries are candidate instants of a range. */
function unitsOf(rule: ResolvedRule) {
  const periods: ResolvedPeriod[] = [];

  switch (rule.kind) {
    case "rollingCap":
      periods.push(rule.window);
      break;
    case "fixedPeriodCap":
      periods.push(rule.period);
      break;
    case "restRequirement":
      periods.push(rule.per);
      break;
    case "freePeriod":
      periods.push(rule.within);
      break;
    case "quota":
      if ("every" in rule.reset) {
        periods.push(rule.reset.every);
      }
      break;
    case "dueBy":
    case "pattern":
      periods.push(rule.period);
      break;
    case "occurrenceCap":
      periods.push(rule.per);
      break;
    case "usageLookback":
      periods.push(rule.notWithin);
      break;
    default:
      break;
  }

  return periods.flatMap((period) =>
    period.kind === "units" ? [period.unit] : [],
  );
}

const NANOSECONDS_PER_DAY = 86_400_000_000_000n;

/**
 * More than any one local period of a unit can last: its longest calendar length plus a week. A
 * clock change moves the wall clock by less than 48 hours, since Temporal holds every offset
 * strictly within ±24 hours, so neither a skipped date nor a repeated stretch can add a week.
 */
const LONGER_THAN_ANY: Readonly<
  Record<Extract<ResolvedPeriod, { kind: "units" }>["unit"], bigint>
> = {
  operatorDay: 8n * NANOSECONDS_PER_DAY,
  day: 8n * NANOSECONDS_PER_DAY,
  week: 14n * NANOSECONDS_PER_DAY,
  month: 38n * NANOSECONDS_PER_DAY,
  year: 373n * NANOSECONDS_PER_DAY,
};

/**
 * Call `visit` with the end of every period of `scale` that ends inside `(from, until]`, starting
 * with the one `from` falls in.
 *
 * - Throws `Unrepresentable` when more than `MAX_PERIOD_COUNT` periods end there, or for a period
 *   Temporal cannot hold.
 * - A span of `MAX_PERIOD_COUNT + 1` times `LONGER_THAN_ANY` or more certainly holds more ends
 *   than that, so it is refused without a lookup. A shorter span is walked, and the walk decides.
 */
export function walkBoundaries(
  scale: UnitScale,
  unit: Extract<ResolvedPeriod, { kind: "units" }>["unit"],
  from: bigint,
  until: bigint,
  visit: (boundary: bigint) => void,
): void {
  if (from >= until) {
    return;
  }

  if (until - from >= BigInt(MAX_PERIOD_COUNT + 1) * LONGER_THAN_ANY[unit]) {
    throw new Unrepresentable("too many periods in the range");
  }

  let current = scale.containing(from);

  for (let step = 0; current !== null && current.end <= until; step++) {
    if (step >= MAX_PERIOD_COUNT) {
      throw new Unrepresentable("too many periods in the range");
    }
    visit(current.end);
    current = scale.containing(current.end);
  }

  if (current === null) {
    throw new Unrepresentable("period outside the instant range");
  }
}

/**
 * The runs whose lengths a rule compares with floors, and the floors: where a run reaches a floor
 * (`start + floor`), or, inside a sliding window, shrinks below it (`end + length − floor`), the
 * rule's answer can change between entry bounds.
 */
function runFloors(
  rule: ResolvedRule,
): { test: StatusKey; floors: bigint[]; sliding: boolean }[] {
  switch (rule.kind) {
    case "cumulativeCap":
      return [
        {
          test: rule.since.statuses,
          floors: [rule.since.consecutive],
          sliding: false,
        },
      ];
    case "elapsedWindow":
      return [
        {
          test: rule.since.statuses,
          floors: [
            rule.since.consecutive,
            ...(rule.exclude === null
              ? []
              : [rule.exclude.each, rule.exclude.one]),
          ],
          sliding: false,
        },
      ];
    case "requiredInterruption": {
      return [
        {
          test: { not: rule.countedStatuses, within: rule.outsideStatuses },
          floors: [rule.minimum, ...(rule.orderedSplit ?? [])],
          sliding: false,
        },
      ];
    }
    case "rollingCap":
      return [
        ...(rule.reset === null
          ? []
          : [
              {
                test: rule.reset.statuses,
                floors: [rule.reset.consecutive],
                sliding: false,
              },
            ]),
        ...(rule.precondition === null
          ? []
          : [
              {
                test: rule.precondition.restStatuses,
                floors: [rule.precondition.minimum],
                sliding: true,
              },
            ]),
      ];
    case "restRequirement": {
      const floors = [rule.minimum];
      if (rule.composition !== null) {
        floors.push(rule.composition.longestAtLeast);
        if (rule.composition.othersAtLeast > 0n) {
          floors.push(rule.composition.othersAtLeast);
        }
      }
      if (rule.composite !== null) {
        floors.push(
          rule.composite.consecutive,
          rule.composite.blockMinimum,
          rule.composite.consecutive + rule.composite.additional,
        );
      }
      return [{ test: rule.restStatuses, floors, sliding: true }];
    }
    case "freePeriod":
      // Multiples are added per run in `candidateInstants`: a run holds floor(length / minimum).
      return [];
    case "quota":
      return "every" in rule.reset
        ? []
        : [
            {
              test: rule.reset.statuses,
              floors: [rule.reset.consecutive],
              sliding: false,
            },
          ];
    case "dueBy":
      return [
        { test: rule.statuses, floors: [rule.minimum], sliding: false },
        ...(rule.reset === null
          ? []
          : [
              {
                test: rule.reset.statuses,
                floors: [rule.reset.consecutive],
                sliding: false,
              },
            ]),
      ];
    case "pattern":
      return rule.classes.map((named) => ({
        test: named.statuses,
        floors: [named.minimum],
        sliding: false,
      }));
    case "usageLookback":
      return [
        {
          test: rule.reset.statuses,
          floors: [rule.reset.consecutive],
          sliding: false,
        },
      ];
    default:
      return [];
  }
}

/**
 * The instants at which a rule's answer can change, inside `(start, end]`.
 *
 * A rule's measures are piecewise linear in the instant evaluated, so a failed window shows at a
 * breakpoint or just either side of one:
 *
 * - every entry bound and use, those bounds shifted by the rule's sliding lengths, and every
 *   boundary of its local periods;
 * - where a run reaches or, in a sliding window, shrinks past a floor the rule compares it with;
 * - for a rest rule that picks its longest runs, where two runs cross as the longest;
 * - where a gap passes `maxGap`, a rest falls due, and a free period gains or loses a local window;
 * - the first instant after `start`, so a window failing as the range opens is seen.
 */
function candidateInstants(
  context: DutyContext,
  rule: ResolvedRule,
  range: UnitSpan,
): bigint[] {
  // Nothing after the log's last entry is judged: the log says nothing about that time.
  const logEnd = context.entries[context.entries.length - 1]?.end;

  if (logEnd === undefined) {
    return [];
  }

  const until = min(range.end, logEnd);
  const base: bigint[] = [];

  for (const entry of context.entries) {
    base.push(entry.start, entry.end);
  }
  if (rule.kind === "usageLookback") {
    base.push(...rule.uses);
  }
  if (rule.kind === "elapsedWindow" && rule.extension !== null) {
    base.push(rule.extension.from);
  }

  // A rule's answer changes only at a breakpoint, so the instants either side of each one also
  // show where a failure starts and where a pass between two failures starts. Only the instants
  // inside `(range.start, until]` are kept.
  const points = new Set<bigint>([range.start + 1n, until]);
  const add = (point: bigint) => {
    if (point > range.start && point <= until) {
      points.add(point);
    }
  };
  const around = (point: bigint) => {
    add(point - 1n);
    add(point);
    add(point + 1n);

    if (points.size > MAX_CANDIDATE_INSTANTS) {
      throw new Unrepresentable("too many instants to check");
    }
  };

  for (const point of base) {
    around(point);
  }
  const shifts = slideLengths(rule);

  for (const shift of shifts) {
    for (const point of base) {
      // A run leaves a window the instant after its bound plus the window's length.
      around(point + shift);
    }
  }

  for (const { test, floors, sliding } of runFloors(rule)) {
    for (const run of runIndex(context.store, test).runs) {
      for (const floor of floors) {
        around(run.start + floor);
        if (sliding) {
          for (const shift of shifts) {
            around(run.end + shift - floor);
          }
        }
      }
    }
  }

  if (rule.kind === "elapsedWindow" && rule.exclude !== null) {
    // The second rest of a pair completes the combined floor part-way through. Its partner is
    // the one `restPairs` gives it: the last earlier run long enough to be half of a pair, with no
    // full rest between. A run shorter than `each` is skipped, never a partner.
    const fullRest = rule.since.consecutive;
    let partner: DutyRun | undefined;

    for (const run of runIndex(context.store, rule.since.statuses).runs) {
      if (partner !== undefined) {
        around(run.start + rule.exclude.combined - length(partner));
      }

      const taken = length(run);

      if (taken >= fullRest) {
        partner = undefined;
      } else if (taken >= rule.exclude.each) {
        partner = run;
      }
    }
  }

  if (rule.kind === "restRequirement") {
    const rests = runIndex(context.store, rule.restStatuses).runs;
    const ranks = rule.composition !== null || rule.composite !== null;

    if (rule.maxGap !== null) {
      // A stretch without rest starts at each rest's end and at the log's first entry.
      for (const start of [
        ...rests.map((run) => run.end),
        ...context.entries.slice(0, 1).map((entry) => entry.start),
      ]) {
        around(start + rule.maxGap);
      }
    }

    for (const shift of ranks ? shifts : []) {
      // A rest that ends two window lengths before the range, or starts two after it, is out of
      // every window the range judges, so it crosses nothing there.
      const near = rests.filter(
        (run) =>
          run.end >= range.start - 2n * shift &&
          run.start <= until + 2n * shift,
      );

      for (let index = 0; index < near.length; index++) {
        const earlier = near[index] as DutyRun;

        // A rest shrinking out of the window crosses one growing at its end, or one held whole.
        // The rests are ordered and separate, so those within two window lengths of `earlier`
        // are one stretch of them: from the first that ends within reach to the first that
        // starts out of it.
        for (
          let other = firstWhere(
            near.length,
            (position) =>
              (near[position] as DutyRun).end > earlier.start - 2n * shift,
          );
          other < near.length;
          other++
        ) {
          const later = near[other] as DutyRun;

          if (later.start - earlier.end >= 2n * shift) {
            break;
          }

          const crossing = (earlier.end + shift + later.start) / 2n;
          around(crossing);
          around(crossing + 1n);
          around(earlier.end + shift - length(later));
          around(later.start + length(earlier));
        }
      }
    }
  }

  if (rule.kind === "freePeriod") {
    const minimum = rule.minimum;
    // A run's points lie at most `atLeast + 1` free periods and a window length past its end, so
    // a run further than that before the range, or after it, adds none inside it.
    const farthest =
      (BigInt(rule.atLeast) + 1n) * minimum +
      shifts.reduce((longest, shift) => max(longest, shift), 0n);
    const rests = runIndex(context.store, rule.restStatuses).runs.filter(
      (run) => run.end + farthest >= range.start && run.start <= until + 1n,
    );
    // A window fails only while it holds fewer than `atLeast` free periods, so a run's count
    // changing above `atLeast` changes no answer: each run's first `atLeast + 1` multiples are
    // the ones that matter. Of those, only the ones that land in the range are taken.
    const reach = BigInt(rule.atLeast) + 1n;
    const multiplesFrom = (origin: bigint, last: bigint) => {
      const first = max(0n, floorDivide(range.start - origin, minimum) - 1n);
      const final = min(last, floorDivide(until - origin, minimum) + 1n);
      for (let multiple = first; multiple <= final; multiple++) {
        around(origin + multiple * minimum);
      }
    };
    const multiplesBefore = (origin: bigint, last: bigint) => {
      const first = max(0n, floorDivide(origin - until, minimum) - 1n);
      const final = min(last, floorDivide(origin - range.start, minimum) + 1n);
      for (let multiple = first; multiple <= final; multiple++) {
        around(origin - multiple * minimum);
      }
    };

    for (const run of rests) {
      const multiples = min(length(run) / minimum + 1n, reach);

      multiplesFrom(run.start, multiples);
      for (const shift of shifts) {
        multiplesBefore(run.end + shift, multiples);
      }

      if (rule.containing !== null) {
        const windows = localWindowsIn(
          context,
          rule.containing.window,
          run.start,
          run.end,
          false,
        );

        for (const window of windows) {
          multiplesFrom(window.end, multiples);
          for (const shift of shifts) {
            around(window.start + shift);
          }
        }
      }
    }
  }

  if (rule.kind === "dueBy") {
    // A rest falls due the instant after its deadline; each run long enough to start the clock,
    // and the log's start, set one.
    const clocks = [
      context.entries[0]?.start,
      ...runIndex(context.store, rule.statuses)
        .runs.filter((run) => length(run) >= rule.minimum)
        .map((run) => run.end),
      ...(rule.reset === null
        ? []
        : runIndex(context.store, rule.reset.statuses)
            .runs.filter(
              (run) =>
                length(run) >=
                (rule.reset as { consecutive: bigint }).consecutive,
            )
            .map((run) => run.end)),
    ];

    for (const clock of clocks) {
      if (clock !== undefined) {
        around(boundaryAfter(context, rule.period, rule.periods, clock));
      }
    }
  }

  // Before the log's first entry and the first use, no rule has anything to fail on, so the
  // period boundaries walked are the ones from there to `until`, however long `range` is.
  const from = max(range.start, firstEvidence(context, rule) as bigint);

  for (const unit of unitsOf(rule)) {
    walkBoundaries(scaleFor(context, unit), unit, from, until, around);
  }

  return [...points]
    .filter((point) => point > range.start && point <= until)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** `a / b` rounded down, for a positive `b`: bigint division rounds towards zero. */
function floorDivide(a: bigint, b: bigint): bigint {
  return a >= 0n ? a / b : -((-a + b - 1n) / b);
}

type Failure = { evaluation: Evaluation; at: bigint };

/**
 * The worse of two failures, `a` the earlier: the larger excess, and on a tie the earlier, whose
 * window is the first to show it (a cap's window ends when the time over it was worked, not after
 * the rest that followed).
 */
function worse(a: Failure, b: Failure): Failure {
  return b.evaluation.excess > a.evaluation.excess ? b : a;
}

/** One violation: its worst failure, and what a later failure must match to join it. */
type Violation = {
  worst: Failure;
  grouping: Grouping;
  /** `"start"`: the key every failure shares. */
  key: bigint;
  /** `"slide"`: false once a check has passed since its last failure. */
  open: boolean;
};

const keyOf = (evaluation: Evaluation): bigint =>
  evaluation.key ?? (evaluation.window as UnitSpan).start;

/** Whether a failure continues a violation: no passing check between, or the same key. */
function continues(violation: Violation, failure: Failure): boolean {
  return violation.grouping === "slide"
    ? violation.open
    : keyOf(failure.evaluation) === violation.key;
}

/** A violation's report after one more failure: the last check of a period, else the worst. */
function report(violation: Violation, failure: Failure): Failure {
  return violation.grouping === "period"
    ? failure
    : worse(violation.worst, failure);
}

/** The kinds that hold rest to a floor, which the record does not judge before the log starts. */
const FLOOR_KINDS: ReadonlySet<ResolvedRule["kind"]> = new Set([
  "restRequirement",
  "freePeriod",
  "pattern",
  "restBeforeDuty",
]);

/**
 * The most instants one rule may be checked at in one range. A log of a year has a few tens of
 * thousands; more than this is refused rather than checked one by one.
 */
const MAX_CANDIDATE_INSTANTS = 1_000_000;

/** Thirty days: how far past a range's end the scan reads at a time, so a period walk stays short. */
const FORWARD_CHUNK = 2_592_000_000_000_000n;

/**
 * The earliest instant a rule has anything to fail on: the log's first entry, or for
 * `usageLookback` its first use when that is earlier. Undefined for an empty log.
 */
function firstEvidence(
  context: DutyContext,
  rule: ResolvedRule,
): bigint | undefined {
  const first = context.entries[0]?.start;

  return first === undefined
    ? undefined
    : [first, ...(rule.kind === "usageLookback" ? rule.uses : [])].reduce(min);
}

/**
 * The violations of one rule, each listed in the range it began in and reported by its worst
 * window, which may end after the range.
 *
 * - Failures inside `range` are grouped into violations as `scanDutyViolations` describes.
 * - The first is dropped when it was already failing at `range.start`: it belongs to the range
 *   before. So two adjacent ranges list every violation once.
 * - The last is followed past `range.end` to its worst window, up to the log's last entry, never
 *   into time the log does not cover.
 */
function ruleViolations(
  context: DutyContext,
  rule: ResolvedRule,
  asked: UnitSpan,
): Failure[] {
  const evidence = firstEvidence(context, rule);

  if (evidence === undefined) {
    return [];
  }

  // Nothing fails before the rule's first evidence, so a range opening earlier opens just
  // before it: no check is made, and no local window resolved, decades before the log.
  const range = { start: max(asked.start, evidence - 1n), end: asked.end };
  // A floor on rest is not judged on a window that starts before the log: the log cannot say
  // what happened then. A cap is, since time no entry covers never counts towards one.
  const logStart = context.entries[0]?.start;
  const judgesRest = FLOOR_KINDS.has(rule.kind);
  const check = (at: bigint) => {
    const evaluation = evaluateRule(context, rule, at, at - 1n);
    const judged =
      evaluation.window !== null &&
      !(
        judgesRest &&
        logStart !== undefined &&
        (evaluation.window.start < logStart || evaluation.beforeLog === true)
      );
    const failure: Failure | null =
      judged && !evaluation.satisfied ? { evaluation, at } : null;
    return { evaluation, failure };
  };
  const violations: Violation[] = [];
  const candidates = candidateInstants(context, rule, range);
  let firstChecked: Failure | null | undefined;

  for (const at of candidates) {
    const { failure } = check(at);
    const last = violations[violations.length - 1];

    if (firstChecked === undefined) {
      firstChecked = failure;
    }

    if (failure === null) {
      if (last !== undefined) {
        last.open = false;
      }
    } else if (last !== undefined && continues(last, failure)) {
      last.worst = report(last, failure);
    } else {
      violations.push({
        worst: failure,
        grouping: failure.evaluation.grouping,
        key: keyOf(failure.evaluation),
        open: true,
      });
    }
  }

  const first = violations[0];

  if (first !== undefined) {
    let before: boolean;

    if (first.grouping === "slide") {
      // Failing from the range's first instant, and already at its start.
      before =
        firstChecked !== undefined &&
        firstChecked !== null &&
        check(range.start).failure !== null;
    } else {
      const key = first.key;
      before =
        key < range.start &&
        candidateInstants(context, rule, { start: key, end: range.start }).some(
          (at) => {
            const { failure } = check(at);
            return failure !== null && continues(first, failure);
          },
        );
    }

    if (before) {
      violations.shift();
    }
  }

  const last = violations[violations.length - 1];
  const logEnd = context.entries[context.entries.length - 1]?.end;

  if (
    last !== undefined &&
    logEnd !== undefined &&
    logEnd > range.end &&
    (last.grouping !== "slide" || last.open)
  ) {
    let cursor = range.end;
    let going = true;

    for (
      let chunk = 0;
      going && cursor < logEnd && chunk <= MAX_PERIOD_COUNT;
      chunk++
    ) {
      const until = min(cursor + FORWARD_CHUNK, logEnd);

      for (const at of candidateInstants(context, rule, {
        start: cursor,
        end: until,
      })) {
        const { evaluation, failure } = check(at);

        if (last.grouping === "slide") {
          if (failure === null) {
            going = false;
            break;
          }
          last.worst = report(last, failure);
        } else if (
          evaluation.window === null ||
          keyOf(evaluation) !== last.key
        ) {
          going = false;
          break;
        } else if (failure !== null) {
          last.worst = report(last, failure);
        }
      }

      cursor = until;
    }
  }

  return violations.map((violation) => violation.worst);
}

/**
 * Every violation of the rules whose severity is `"violation"` inside a range. A moving window's
 * failures are one violation while no check passes between them; a count since a reset, or one
 * fixed period, is one violation however often it is checked. Each is reported by its worst
 * window and listed in the range it began in.
 *
 * @param context the call's context
 * @param rules the resolved rules
 * @param range the range, epoch nanoseconds
 * @returns the violations, ordered by window start and then by rule
 */
export function scanDutyViolations(
  context: DutyContext,
  rules: readonly ResolvedRule[],
  range: UnitSpan,
): DutyViolation[] {
  const found: { order: number; label: string; failure: Failure }[] = [];

  rules.forEach((rule, order) => {
    if (rule.severity === "violation") {
      for (const failure of ruleViolations(context, rule, range)) {
        found.push({ order, label: rule.label, failure });
      }
    }
  });

  return found
    .sort((a, b) => {
      const aStart = (a.failure.evaluation.window as UnitSpan).start;
      const bStart = (b.failure.evaluation.window as UnitSpan).start;
      return aStart < bStart ? -1 : aStart > bStart ? 1 : a.order - b.order;
    })
    .map(({ label, failure }) => ({
      label,
      window: spanText(failure.evaluation.window as UnitSpan),
      used: measureText(failure.evaluation.used) as string | number,
      limit: measureText(failure.evaluation.limit) as string | number,
    }));
}
