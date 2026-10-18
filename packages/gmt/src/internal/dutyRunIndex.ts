import type { DutyLogEntry, DutyRun } from "./dutyLog";
import type { ResolvedPair, StatusSet } from "./dutyRules";
import { coalesceIntervalNanoseconds } from "./intervalNanoseconds";

/**
 * Which entries a view of the log counts: the entries in a set, the entries outside one, or the
 * entries outside one and inside another (`within`; null for any status).
 */
export type StatusKey =
  | StatusSet
  | { not: StatusSet; within?: StatusSet | null };

/** One status test's view of the whole log, built once per call. */
export type RunIndex = {
  entries: readonly DutyLogEntry[];
  entryStarts: readonly bigint[];
  /** `matched[i]`: whether `entries[i]` passes the test. */
  matched: readonly boolean[];
  /** `entryPrefix[i]`: time in the test over `entries[0..i)`; one longer than `entries`. */
  entryPrefix: readonly bigint[];
  /** The runs of the whole log, as today's `runsOf` gives them. */
  runs: readonly DutyRun[];
  runStarts: readonly bigint[];
  runEnds: readonly bigint[];
  /** Per-`(minimum)` and per-`(minimum, maximum)` arrays, built on first use. */
  qualifying: Map<bigint, readonly number[]>;
  events: Map<string, EventList>;
  interruptions: Map<string, InterruptionStates>;
  /** Per-`(fullRest, pair)` tables of the whole log's rest pairs, built on first use. */
  pairTables: Map<string, PairTable>;
};

/**
 * Every rest pair of the whole log: `seconds[k]` and `firsts[k]` are the run indexes of the k-th
 * pair, in order, and `previous[i]` is the run a pair ending at run `i` would start from (-1 for
 * none). Firsts never decrease along the pairs.
 */
type PairTable = {
  seconds: readonly number[];
  firsts: readonly number[];
  previous: readonly number[];
};

/** The runs of the whole log whose length is in a range: their run indexes and starts. */
type EventList = { indexes: readonly number[]; starts: readonly bigint[] };

/** The log and the indexes built from it, kept for one call. */
export type RunStore = {
  entries: readonly DutyLogEntry[];
  entryStarts: readonly bigint[];
  positive: Map<StatusSet, RunIndex>;
  complement: Map<StatusSet, Map<StatusSet | null, RunIndex>>;
  /** `nextMatch(set)[i]`: the first entry at or after `i` in the set, or `entries.length`. */
  nextMatch: Map<StatusSet, readonly number[]>;
};

/** The first `count` runs of an index, the last cut at the instant: the log as it stood there. */
export type RunView = {
  index: RunIndex;
  count: number;
  last: DutyRun | undefined;
};

const length = (run: DutyRun) => run.end - run.start;

/** Binary-search steps: an array holds under 2^32 elements. */
const SEARCH_STEPS = 33;

/**
 * The first position in `[0, count)` where `holds` is true, given it is false and then true; `count`
 * when it never is.
 */
export function firstWhere(
  count: number,
  holds: (position: number) => boolean,
): number {
  let low = 0;
  let high = count;

  for (let step = 0; step < SEARCH_STEPS && low < high; step++) {
    const middle = (low + high) >> 1;

    if (holds(middle)) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }

  return low;
}

/** The first position in `[0, limit)` whose value is at least `target`, in ascending values. */
function lowerBound<T extends bigint | number>(
  values: readonly T[],
  target: T,
  limit: number = values.length,
): number {
  return firstWhere(limit, (position) => (values[position] as T) >= target);
}

/** Maximal runs of touching entries passing `matches`, merged as `mergeIntervals` merges them. */
export function runsMatching(
  entries: readonly DutyLogEntry[],
  matches: (status: string) => boolean,
): DutyRun[] {
  return coalesceIntervalNanoseconds(
    entries
      .filter((entry) => matches(entry.status))
      .map(({ start, end }) => ({ start, end, startText: "", endText: "" })),
  ).map(({ start, end }) => ({ start, end }));
}

/** The index of a log's entries under a test. */
function buildIndex(
  store: RunStore,
  matches: (status: string) => boolean,
): RunIndex {
  const { entries } = store;
  const matched = entries.map((entry) => matches(entry.status));
  const entryPrefix: bigint[] = [0n];
  let total = 0n;

  for (let position = 0; position < entries.length; position++) {
    const entry = entries[position] as DutyLogEntry;

    if (matched[position]) {
      total += entry.end - entry.start;
    }
    entryPrefix.push(total);
  }

  const runs = runsMatching(entries, matches);

  return {
    entries,
    entryStarts: store.entryStarts,
    matched,
    entryPrefix,
    runs,
    runStarts: runs.map((run) => run.start),
    runEnds: runs.map((run) => run.end),
    qualifying: new Map(),
    events: new Map(),
    interruptions: new Map(),
    pairTables: new Map(),
  };
}

/**
 * A call's store: the entries and, as tests ask for them, an index of each.
 *
 * @param entries the parsed log, ordered and separate
 */
export function createRunStore(entries: readonly DutyLogEntry[]): RunStore {
  return {
    entries,
    entryStarts: entries.map((entry) => entry.start),
    positive: new Map(),
    complement: new Map(),
    nextMatch: new Map(),
  };
}

/**
 * The index of a test, built on first use and kept: a set or the complement of one is keyed by its
 * set object, which the rules hold once per call.
 */
export function runIndex(store: RunStore, test: StatusKey): RunIndex {
  if (test instanceof Set) {
    let known = store.positive.get(test);

    if (known === undefined) {
      known = buildIndex(store, (status) => test.has(status));
      store.positive.set(test, known);
    }

    return known;
  }

  const { not, within = null } = test as {
    not: StatusSet;
    within?: StatusSet | null;
  };
  let byWithin = store.complement.get(not);

  if (byWithin === undefined) {
    byWithin = new Map();
    store.complement.set(not, byWithin);
  }

  let known = byWithin.get(within);

  if (known === undefined) {
    known = buildIndex(
      store,
      (status) => !not.has(status) && (within === null || within.has(status)),
    );
    byWithin.set(within, known);
  }

  return known;
}

/** Time in the test over `[-∞, t)`, whole entries by prefix and the entry holding `t` by part. */
function cumulative(index: RunIndex, t: bigint): bigint {
  const taken = lowerBound(index.entryStarts, t);

  if (taken === 0) {
    return 0n;
  }

  const entry = index.entries[taken - 1] as DutyLogEntry;
  const prefix = index.entryPrefix[taken - 1] as bigint;

  return index.matched[taken - 1]
    ? prefix + ((entry.end < t ? entry.end : t) - entry.start)
    : prefix;
}

/**
 * Time in the test inside `[from, to)` of the log as it stood at `at`: entries starting at or after
 * `at` are gone and the one straddling it ends there.
 *
 * @example timeInBefore(index, 0n, 100n, 10n) // time in the test inside [0, 10)
 */
export function timeInBefore(
  index: RunIndex,
  from: bigint,
  to: bigint,
  at: bigint,
): bigint {
  const upper = to < at ? to : at;

  return upper > from ? cumulative(index, upper) - cumulative(index, from) : 0n;
}

/** The runs of the log as it stood at `at`: no copy, the last cut there. */
export function runsUntil(index: RunIndex, at: bigint): RunView {
  const count = lowerBound(index.runStarts, at);
  const run = count > 0 ? (index.runs[count - 1] as DutyRun) : undefined;

  return {
    index,
    count,
    last:
      run !== undefined && run.end > at ? { start: run.start, end: at } : run,
  };
}

/** The `position`-th run of a view, the last one cut. */
export function viewRun(view: RunView, position: number): DutyRun {
  return position === view.count - 1
    ? (view.last as DutyRun)
    : (view.index.runs[position] as DutyRun);
}

/** The first position in a view whose run ends after `t`; the view's count when none does. */
export function firstEndingAfter(view: RunView, t: bigint): number {
  return firstWhere(view.count, (position) => viewRun(view, position).end > t);
}

/** The first position in a view whose run starts at or after `t`; the view's count when none. */
export function firstStartingAtOrAfter(view: RunView, t: bigint): number {
  return lowerBound(view.index.runStarts, t, view.count);
}

/** For each run, the index of the latest run up to it of at least `minimum`, or -1. */
function qualifyingAt(index: RunIndex, minimum: bigint): readonly number[] {
  let known = index.qualifying.get(minimum);

  if (known === undefined) {
    const found: number[] = [];
    let latest = -1;

    for (let position = 0; position < index.runs.length; position++) {
      if (length(index.runs[position] as DutyRun) >= minimum) {
        latest = position;
      }
      found.push(latest);
    }

    known = found;
    index.qualifying.set(minimum, known);
  }

  return known;
}

/**
 * The latest of a view's first `taken` runs that is at least `minimum` long. The view's last run
 * counts at its cut length.
 */
export function latestAtLeast(
  view: RunView,
  taken: number,
  minimum: bigint,
): DutyRun | undefined {
  let whole = taken - 1;

  if (taken === view.count && view.last !== undefined) {
    if (length(view.last) >= minimum) {
      return view.last;
    }
    whole = taken - 2;
  }

  const position =
    whole < 0 ? -1 : (qualifyingAt(view.index, minimum)[whole] as number);

  return position < 0 ? undefined : (view.index.runs[position] as DutyRun);
}

/** The latest run in a view at least `minimum` long. */
export function lastAtLeastUntil(
  view: RunView,
  minimum: bigint,
): DutyRun | undefined {
  return latestAtLeast(view, view.count, minimum);
}

/** How many of a view's first runs end at or before `t`. */
export function endingAtOrBefore(view: RunView, t: bigint): number {
  return firstEndingAfter(view, t);
}

/** The run of a view that ends at `t`, if one does. */
export function runEndingAt(view: RunView, t: bigint): DutyRun | undefined {
  const position = firstEndingAfter(view, t - 1n);

  if (position >= view.count) {
    return undefined;
  }

  const run = viewRun(view, position);

  return run.end === t ? run : undefined;
}

function eventsOf(
  index: RunIndex,
  minimum: bigint,
  maximum: bigint | null,
): EventList {
  const key = `${minimum}:${maximum ?? ""}`;
  let known = index.events.get(key);

  if (known === undefined) {
    const indexes: number[] = [];
    const starts: bigint[] = [];

    for (let position = 0; position < index.runs.length; position++) {
      const run = index.runs[position] as DutyRun;
      const taken = length(run);

      if (taken >= minimum && (maximum === null || taken < maximum)) {
        indexes.push(position);
        starts.push(run.start);
      }
    }

    known = { indexes, starts };
    index.events.set(key, known);
  }

  return known;
}

/**
 * How many of a view's runs of at least `minimum` and under `maximum` (`null`: no upper bound)
 * start in `[from, to)` (`null`: no upper bound). The view's last run counts at its cut length,
 * and not at all when it ends at `skipEndingAt`.
 */
export function countEvents(
  view: RunView,
  bounds: { minimum: bigint; maximum: bigint | null },
  range: { from: bigint; to: bigint | null },
  skipEndingAt: bigint | null,
): number {
  const { minimum, maximum } = bounds;
  const { from, to } = range;
  const list = eventsOf(view.index, minimum, maximum);
  const whole = lowerBound(list.indexes, view.count - 1);
  const low = lowerBound(list.starts, from, whole);
  const high = to === null ? whole : lowerBound(list.starts, to, whole);
  let found = high > low ? high - low : 0;
  const { last } = view;

  if (last !== undefined) {
    const taken = length(last);

    if (
      taken >= minimum &&
      (maximum === null || taken < maximum) &&
      last.start >= from &&
      (to === null || last.start < to) &&
      last.end !== skipEndingAt
    ) {
      found++;
    }
  }

  return found;
}

/** The entries starting before `at`: the log's length at `at`. */
function entriesBefore(store: RunStore, at: bigint): number {
  return lowerBound(store.entryStarts, at);
}

/** The start of the log's first entry, when it starts before `at`. */
export function logStartBefore(
  store: RunStore,
  at: bigint,
): bigint | undefined {
  const first = store.entries[0];

  return first !== undefined && first.start < at ? first.start : undefined;
}

/** The log's last entry as it stood at `at`, cut there. */
export function lastEntryBefore(
  store: RunStore,
  at: bigint,
): DutyLogEntry | undefined {
  const taken = entriesBefore(store, at);
  const entry = taken > 0 ? store.entries[taken - 1] : undefined;

  return entry !== undefined && entry.end > at ? { ...entry, end: at } : entry;
}

/** The entry holding the instant `at`, if one does (start ≤ at < end). */
export function entryHolding(
  store: RunStore,
  at: bigint,
): DutyLogEntry | undefined {
  const taken = lowerBound(store.entryStarts, at + 1n);
  const entry = taken > 0 ? store.entries[taken - 1] : undefined;

  return entry !== undefined && entry.end > at ? entry : undefined;
}

/**
 * The first entry in `statuses` that starts at or after `from` (`null`: any) and before `at`.
 */
export function firstEntryIn(
  store: RunStore,
  statuses: StatusSet,
  from: bigint | null,
  at: bigint,
): DutyLogEntry | undefined {
  let next = store.nextMatch.get(statuses);

  if (next === undefined) {
    const found: number[] = Array.from(
      { length: store.entries.length + 1 },
      () => store.entries.length,
    );

    for (let position = store.entries.length - 1; position >= 0; position--) {
      found[position] = statuses.has(
        (store.entries[position] as DutyLogEntry).status,
      )
        ? position
        : (found[position + 1] as number);
    }

    next = found;
    store.nextMatch.set(statuses, next);
  }

  const begin = from === null ? 0 : lowerBound(store.entryStarts, from);
  const entry = store.entries[next[begin] as number];

  return entry !== undefined && entry.start < at ? entry : undefined;
}

/** Where a required-interruption count stands after each break of the log. */
type InterruptionStates = {
  resetAt: readonly (bigint | null)[];
  part: readonly number[];
};

/** One break applied to a required-interruption state. */
function interrupt(
  state: { resetAt: bigint | null; part: number },
  pause: DutyRun,
  minimum: bigint,
  split: readonly bigint[] | null,
): { resetAt: bigint | null; part: number } {
  const taken = length(pause);

  if (taken >= minimum) {
    return { resetAt: pause.end, part: 0 };
  }

  if (split !== null && taken >= (split[state.part] as bigint)) {
    const part = state.part + 1;

    return part === split.length
      ? { resetAt: pause.end, part: 0 }
      : { resetAt: state.resetAt, part };
  }

  return state;
}

/**
 * Where a required-interruption count was reset, taking every break a view holds in order: a break
 * of `minimum` resets it, and breaks that meet `split` one after another in order reset it too.
 *
 * @returns the instant of the last reset, or null when none
 */
export function interruptionResetAt(
  view: RunView,
  minimum: bigint,
  split: readonly bigint[] | null,
): bigint | null {
  const { index } = view;
  const key = `${minimum}|${split === null ? "" : split.join(",")}`;
  let states = index.interruptions.get(key);

  if (states === undefined) {
    const resetAt: (bigint | null)[] = [];
    const part: number[] = [];
    let state: { resetAt: bigint | null; part: number } = {
      resetAt: null,
      part: 0,
    };

    for (const pause of index.runs) {
      state = interrupt(state, pause, minimum, split);
      resetAt.push(state.resetAt);
      part.push(state.part);
    }

    states = { resetAt, part };
    index.interruptions.set(key, states);
  }

  if (view.last === undefined) {
    return null;
  }

  const before = view.count - 2;
  const state = interrupt(
    before < 0
      ? { resetAt: null, part: 0 }
      : {
          resetAt: states.resetAt[before] as bigint | null,
          part: states.part[before] as number,
        },
    view.last,
    minimum,
    split,
  );

  return state.resetAt;
}

/** Whether two rests of these lengths, in a row and each over the floor, are a pair. */
function qualifies(
  pair: ResolvedPair,
  earlier: bigint,
  later: bigint,
): boolean {
  return (
    (earlier > later ? earlier : later) >= pair.one &&
    earlier + later >= pair.combined
  );
}

/** The pairs of the whole log for these floors, as `restPairs` finds them, built once. */
function pairTableOf(
  index: RunIndex,
  fullRest: bigint,
  pair: ResolvedPair,
): PairTable {
  const key = `${fullRest}|${pair.each}|${pair.one}|${pair.combined}`;
  const pairs = (earlier: bigint, taken: bigint) =>
    qualifies(pair, earlier, taken);
  let known = index.pairTables.get(key);

  if (known === undefined) {
    const seconds: number[] = [];
    const firsts: number[] = [];
    const previous: number[] = [];
    let before = -1;

    for (const [position, run] of index.runs.entries()) {
      const taken = length(run);

      previous.push(before);
      if (taken >= fullRest) {
        before = -1;
      } else if (taken >= pair.each) {
        if (
          before >= 0 &&
          pairs(length(index.runs[before] as DutyRun), taken)
        ) {
          seconds.push(position);
          firsts.push(before);
        }
        before = position;
      }
    }
    known = { seconds, firsts, previous };
    index.pairTables.set(key, known);
  }

  return known;
}

/**
 * The latest rest pair among a view's runs from `from` on: what the last of
 * `restPairs(viewRunsFrom(view, from), fullRest, pair)` is, without walking the runs. Only the
 * view's last run is cut, so it is tried by itself and every earlier pair comes from the whole-log
 * table.
 */
export function latestPairFrom(
  view: RunView,
  from: number,
  fullRest: bigint,
  pair: ResolvedPair,
): { first: DutyRun; second: DutyRun } | undefined {
  const { index, count, last } = view;

  if (count === 0 || last === undefined) {
    return undefined;
  }
  const table = pairTableOf(index, fullRest, pair);
  const taken = length(last);
  const before = table.previous[count - 1] as number;

  if (taken < fullRest && taken >= pair.each && before >= from) {
    const earlier = index.runs[before] as DutyRun;

    if (qualifies(pair, length(earlier), taken)) {
      return { first: earlier, second: last };
    }
  }
  const found =
    firstWhere(
      table.seconds.length,
      (k) => (table.seconds[k] as number) >= count - 1,
    ) - 1;

  return found >= 0 && (table.firsts[found] as number) >= from
    ? {
        first: index.runs[table.firsts[found] as number] as DutyRun,
        second: index.runs[table.seconds[found] as number] as DutyRun,
      }
    : undefined;
}

/** How many of the ascending values are in `[low, high)`. */
export function countInRange(
  sorted: readonly bigint[],
  low: bigint,
  high: bigint,
): number {
  return high > low ? lowerBound(sorted, high) - lowerBound(sorted, low) : 0;
}
