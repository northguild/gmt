import {
  MAX_EPOCH_DAY,
  epochDayOf,
  isoDateString,
} from "../../internal/epochDay";
import { plainDateTimeOf } from "../../internal/inputChecks";
import { parseInstantNanoseconds } from "../../internal/instantNanoseconds";
import { instantStringFromEpochNanoseconds } from "../../internal/instantStringFromEpochNanoseconds";
import { isOptionsArgument } from "../../internal/isObject";
import {
  createLocalResolver,
  localNanoseconds,
  readOccurrenceWindow,
  resolveLocalMoment,
  type OccurrenceWindowNanoseconds,
  type ResolvedLocal,
} from "../../internal/localResolution";
import {
  MAX_EPOCH_NANOSECONDS,
  MIN_EPOCH_NANOSECONDS,
} from "../../internal/epochNanoseconds";
import { optionOrDefault } from "../../internal/optionOrDefault";
import {
  RECURRENCE_WORK_CAP,
  expandLocalMoments,
  type LocalMoment,
} from "../../internal/recurrenceExpansion";
import { checkRecurrenceRule } from "../../internal/recurrenceRuleText";
import { zoneFrame, type ZoneFrame } from "../../internal/zoneFrame";
import { offsetAt } from "../../internal/zonedWallClock";
import type {
  ExpandRecurrenceOptions,
  OccurrenceWindow,
  RecurrenceOccurrence,
  RecurrenceRule,
} from "../../types";

const NANOSECONDS_PER_SECOND = 1_000_000_000n;
const SECONDS_PER_DAY = 86_400n;
const DAY = SECONDS_PER_DAY * NANOSECONDS_PER_SECOND;
/**
 * A moment read as UTC is within a day of the instant it names (Temporal keeps an offset under
 * 24 hours), so three days of slack never drops a row and never keeps a loop running.
 */
const SLACK = 3n * DAY;
const MAX_ROWS = 10_000;
const POLICIES = ["compatible", "earlier", "later", "reject"];

type Row = {
  local: string;
  instant: bigint;
  kind: ResolvedLocal["kind"];
  earlier: bigint;
  later: bigint;
  /** Under `"reject"`, a skipped or repeated wall time: the call returns `[]` if this row is returned. */
  refused: boolean;
};

type Entry = { moment: LocalMoment; local: string; instant: bigint | null };

/** An `rdate` entry placed in the zone. */
type Placed = { entry: Entry; resolved: ResolvedLocal; instant: bigint };

function momentOf(wall: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}): LocalMoment {
  return {
    day: epochDayOf(wall.year, wall.month, wall.day),
    second: wall.hour * 3600 + wall.minute * 60 + wall.second,
  };
}

function localString(moment: LocalMoment): string {
  const second = moment.second;
  const part = (value: number): string => String(value).padStart(2, "0");

  return `${isoDateString(moment.day)}T${part(Math.floor(second / 3600))}:${part(Math.floor((second % 3600) / 60))}:${part(second % 60)}`;
}

/**
 * Whether the text carries a bracketed annotation (RFC 9557). The zone an annotation names would
 * have to override `timeZone`, and a call has one zone, so DTSTART and every entry are read bare.
 */
function isAnnotated(value: string): boolean {
  return value.includes("[");
}

/** DTSTART or a wall-time list entry: a whole-second ISO date-time with no offset or annotation. */
function readWall(value: unknown): LocalMoment | null {
  if (typeof value !== "string" || isAnnotated(value)) {
    return null;
  }

  const wall = plainDateTimeOf(value);

  if (
    wall === null ||
    wall.millisecond !== 0 ||
    wall.microsecond !== 0 ||
    wall.nanosecond !== 0
  ) {
    return null;
  }

  return momentOf(wall);
}

function readEntry(value: unknown, frame: ZoneFrame): Entry | null {
  const moment = readWall(value);

  if (moment !== null) {
    return { moment, local: localString(moment), instant: null };
  }

  const instant =
    typeof value === "string" && !isAnnotated(value)
      ? parseInstantNanoseconds(value)
      : null;

  if (instant === null || instant % NANOSECONDS_PER_SECOND !== 0n) {
    return null;
  }

  const local =
    (instant + offsetAt(frame.timeZone, instant) + frame.shiftNanoseconds) /
    NANOSECONDS_PER_SECOND;
  const day = Number(
    local / SECONDS_PER_DAY - (local % SECONDS_PER_DAY < 0n ? 1n : 0n),
  );
  const found = { day, second: Number(local - BigInt(day) * SECONDS_PER_DAY) };

  return { moment: found, local: localString(found), instant };
}

function readEntries(list: unknown, frame: ZoneFrame): Entry[] | null {
  if (list === undefined) {
    return [];
  }

  if (!Array.isArray(list)) {
    return null;
  }

  const entries: Entry[] = [];

  for (const value of list) {
    const entry = readEntry(value, frame);

    if (entry === null) {
      return null;
    }

    entries.push(entry);
  }

  return entries;
}

function chosenInstant(resolved: ResolvedLocal, policy: string): bigint {
  if (resolved.kind === "unique") {
    return resolved.earlier;
  }

  // "reject" places every row as "compatible"; the refusal is applied to the returned rows.
  if (
    policy === "later" ||
    ((policy === "compatible" || policy === "reject") &&
      resolved.kind === "nonexistent")
  ) {
    return resolved.later;
  }

  return resolved.earlier;
}

function rowOf(
  local: string,
  resolved: ResolvedLocal,
  instant: bigint,
  refusable: boolean,
): Row {
  return {
    local,
    instant,
    kind: resolved.kind,
    earlier: resolved.earlier,
    later: resolved.later,
    refused: refusable && resolved.kind !== "unique",
  };
}

function compareRows(a: Row, b: Row): number {
  if (a.instant !== b.instant) {
    return a.instant < b.instant ? -1 : 1;
  }

  if (a.local === b.local) {
    return 0;
  }

  return a.local < b.local ? -1 : 1;
}

/** Whether every instant is one Temporal can hold (TC39 IsValidEpochNanoseconds). */
function isRepresentable(...instants: bigint[]): boolean {
  return instants.every(
    (instant) =>
      instant >= MIN_EPOCH_NANOSECONDS && instant <= MAX_EPOCH_NANOSECONDS,
  );
}

/** Whether an instant is inside the window: after `after`, or from `start` up to but not including `end`. */
function isInside(
  window: OccurrenceWindowNanoseconds,
  instant: bigint,
): boolean {
  return window.kind === "after"
    ? instant > window.after
    : instant >= window.start && instant < window.end;
}

function lowerBound(window: OccurrenceWindowNanoseconds): bigint {
  return window.kind === "after" ? window.after : window.start;
}

function floorDay(nanoseconds: bigint): number {
  const days = nanoseconds / DAY;

  return Number(
    nanoseconds < 0n && nanoseconds % DAY !== 0n ? days - 1n : days,
  );
}

/** The rows collected so far, and the bound past which later moments cannot matter. */
type Collector = {
  rows: Row[];
  /** Distinct instants in ascending order, kept only for the `count` form. */
  nearest: bigint[];
  instants: Set<bigint>;
  /** Moments read as UTC beyond this are not looked at, or null while unbounded. */
  limit(): bigint | null;
  /** Whether an interval window already holds more rows than a call may return. */
  over(): boolean;
  add(row: Row): void;
};

function createCollector(window: OccurrenceWindowNanoseconds): Collector {
  const rows: Row[] = [];
  const nearest: bigint[] = [];
  const instants = new Set<bigint>();

  return {
    rows,
    nearest,
    instants,
    limit() {
      if (window.kind === "interval") {
        return window.end + SLACK;
      }

      return nearest.length >= window.count
        ? nearest[window.count - 1]! + SLACK
        : null;
    },
    over() {
      return window.kind === "interval" && instants.size > MAX_ROWS;
    },
    add(row) {
      // A row past the count-th nearest instant can never be among the first `count`.
      if (
        window.kind === "after" &&
        nearest.length >= window.count &&
        row.instant > nearest[window.count - 1]!
      ) {
        return;
      }

      rows.push(row);

      if (instants.has(row.instant)) {
        return;
      }

      instants.add(row.instant);

      if (window.kind === "after") {
        let low = 0;
        let high = nearest.length;

        while (low < high) {
          const middle = (low + high) >>> 1;

          if (nearest[middle]! < row.instant) {
            low = middle + 1;
          } else {
            high = middle;
          }
        }

        nearest.splice(low, 0, row.instant);

        if (nearest.length > window.count) {
          nearest.pop();
        }
      }
    },
  };
}

type Call = {
  rule: RecurrenceRule;
  start: LocalMoment;
  frame: ZoneFrame;
  window: OccurrenceWindowNanoseconds;
  policy: string;
  until: bigint | null;
  /** The instants `exdate` removes: each wall-time entry as the policy places it, and each instant entry. */
  excludedInstants: Set<bigint>;
  rdate: Placed[];
  /** Under `"reject"`, whether `start` or a wall-time `rdate` or `exdate` entry is skipped or repeated. */
  refused: boolean;
};

/** Whether the expansion can stop before the moment `local`: the rule, `UNTIL` or the window is spent. */
function isSpent(
  call: Call,
  collector: Collector,
  local: bigint,
  first: boolean,
): boolean {
  const limit = collector.limit();
  const pastUntil = !first && call.until !== null && local > call.until + SLACK;
  // Nothing past Temporal's range can be a row, so the expansion ends there.
  const pastRange = local > MAX_EPOCH_NANOSECONDS + SLACK;

  return (
    pastUntil ||
    pastRange ||
    (limit !== null && local > limit) ||
    collector.over()
  );
}

/**
 * Whether a placed row is left out: after `UNTIL`, outside the window or Temporal's range, or
 * removed by `exdate`. Both readings must be in range, as Temporal's GetPossibleEpochNanoseconds
 * requires of a repeated wall time; a skipped one is held to the same rule.
 */
function isDropped(call: Call, row: Row, first: boolean): boolean {
  const afterUntil = !first && call.until !== null && row.instant > call.until;

  return (
    afterUntil ||
    !isInside(call.window, row.instant) ||
    !isRepresentable(row.instant, row.earlier, row.later) ||
    call.excludedInstants.has(row.instant)
  );
}

function resolveOrNull(
  resolve: (moment: LocalMoment) => ResolvedLocal,
  moment: LocalMoment,
): ResolvedLocal | null {
  try {
    return resolve(moment);
  } catch {
    return null;
  }
}

/** Place one moment and keep it when it is inside the window and not removed. */
function consider(
  call: Call,
  collector: Collector,
  resolve: (moment: LocalMoment) => ResolvedLocal,
  moment: LocalMoment,
  first: boolean,
): void {
  const resolved = resolveOrNull(resolve, moment);

  // A moment Temporal cannot place is past its range, so it is no row.
  if (resolved === null) {
    return;
  }

  const row = rowOf(
    localString(moment),
    resolved,
    chosenInstant(resolved, call.policy),
    call.policy === "reject",
  );

  if (!isDropped(call, row, first)) {
    collector.add(row);
  }
}

/** Collect the rule's rows. Returns false when the work cap ended the expansion. */
function collectGenerated(call: Call, collector: Collector): boolean {
  const { rule, start, window } = call;
  const resolve = createLocalResolver(call.frame);
  const skipBefore = lowerBound(window) - SLACK;
  const fromDay =
    rule.count !== undefined
      ? start.day
      : Math.max(start.day, floorDay(lowerBound(window)) - 3);
  let visited = 0;
  // The expansion ends once a period starts past the collector's limit, so a rule with no later
  // occurrence stops as "end" (DTSTART kept) instead of at the work cap. The count form has a limit
  // only once it holds `count` distinct instants.
  const lastDay = (): number => {
    const limit = collector.limit();

    return limit === null ? MAX_EPOCH_DAY : floorDay(limit);
  };

  const status = expandLocalMoments(
    rule,
    start,
    fromDay,
    (moment) => {
      const first = visited === 0;
      visited += 1;
      const local = localNanoseconds(moment);

      if (
        (rule.count !== undefined && visited > rule.count) ||
        isSpent(call, collector, local, first)
      ) {
        return false;
      }

      if (local >= skipBefore) {
        consider(call, collector, resolve, moment, first);
      }

      return true;
    },
    RECURRENCE_WORK_CAP,
    lastDay,
  );

  return status !== "capped";
}

/** Add the `rdate` rows. */
function addEntryRows(call: Call, collector: Collector): void {
  for (const { entry, resolved, instant } of call.rdate) {
    const row = rowOf(
      entry.local,
      resolved,
      instant,
      call.policy === "reject" && entry.instant === null,
    );

    if (
      isInside(call.window, instant) &&
      isRepresentable(instant, resolved.earlier, resolved.later) &&
      !call.excludedInstants.has(instant)
    ) {
      collector.add(row);
    }
  }
}

/** Sort and collapse equal instants to the first row in local order. */
function collapse(rows: Row[]): Row[] {
  rows.sort(compareRows);
  const merged: Row[] = [];

  for (const row of rows) {
    if (
      merged.length === 0 ||
      merged[merged.length - 1]!.instant !== row.instant
    ) {
      merged.push(row);
    }
  }

  return merged;
}

function occurrenceOf(row: Row): RecurrenceOccurrence | null {
  const instant = instantStringFromEpochNanoseconds(row.instant);
  const earlier = instantStringFromEpochNanoseconds(row.earlier);
  const later = instantStringFromEpochNanoseconds(row.later);

  return instant === "" || earlier === "" || later === ""
    ? null
    : { local: row.local, instant, classification: row.kind, earlier, later };
}

/** Cut the merged rows to the window's count; null when the result is refused or too large. */
function finish(
  rows: Row[],
  window: OccurrenceWindowNanoseconds,
): RecurrenceOccurrence[] | null {
  const merged = collapse(rows);
  const chosen =
    window.kind === "after" ? merged.slice(0, window.count) : merged;

  if (chosen.length > MAX_ROWS || chosen.some((row) => row.refused)) {
    return null;
  }

  const result = chosen.map(occurrenceOf);

  return result.includes(null) ? null : (result as RecurrenceOccurrence[]);
}

/**
 * Place the wall-time entries as the policy places them and keep the explicit ones as they are.
 * An entry Temporal cannot place is past its range: it names no instant, so it is left out.
 */
function placeEntries(
  entries: readonly Entry[],
  frame: ZoneFrame,
  policy: string,
): Placed[] {
  const placed: Placed[] = [];

  for (const entry of entries) {
    const resolved = resolveOrNull(
      (moment) => resolveLocalMoment(frame, moment),
      entry.moment,
    );

    if (resolved !== null) {
      placed.push({
        entry,
        resolved,
        instant: entry.instant ?? chosenInstant(resolved, policy),
      });
    }
  }

  return placed;
}

/** Whether `"reject"` refuses the call: `start` or a wall-time entry is a skipped or repeated wall time. */
function isRefused(
  policy: string,
  frame: ZoneFrame,
  start: LocalMoment,
  walls: readonly Placed[],
): boolean {
  if (policy !== "reject") {
    return false;
  }

  const startKind = resolveOrNull(
    (moment) => resolveLocalMoment(frame, moment),
    start,
  )?.kind;

  return (
    (startKind !== undefined && startKind !== "unique") ||
    walls.some(
      ({ entry, resolved }) =>
        entry.instant === null && resolved.kind !== "unique",
    )
  );
}

/** The rule, if it is one `expandRecurrence` can expand: valid, and with `UNTIL` in UTC if it has one. */
function expandableRule(
  rule: RecurrenceRule,
): { rule: RecurrenceRule; until: bigint | null } | null {
  const checked = checkRecurrenceRule(rule);

  if (checked === null) {
    return null;
  }

  if (checked.until === undefined) {
    return { rule: checked, until: null };
  }

  const until = checked.until.endsWith("Z")
    ? parseInstantNanoseconds(checked.until)
    : null;

  return until === null ? null : { rule: checked, until };
}

/** The options, read once: the policy, and the `rdate` and `exdate` entries. */
function readOptions(
  options: ExpandRecurrenceOptions | undefined,
  frame: ZoneFrame,
): { policy: string; rdate: Entry[]; exdate: Entry[] } | null {
  if (!isOptionsArgument(options)) {
    return null;
  }

  const policy = optionOrDefault(
    options?.disambiguation,
    "compatible",
  ) as string;
  const rdate = readEntries(options?.rdate, frame);
  const exdate = readEntries(options?.exdate, frame);

  return POLICIES.includes(policy) && rdate !== null && exdate !== null
    ? { policy, rdate, exdate }
    : null;
}

/** Read every argument once, or null when any is invalid. */
function readCall(
  rule: RecurrenceRule,
  start: string,
  timeZone: string,
  window: OccurrenceWindow,
  options: ExpandRecurrenceOptions | undefined,
): Call | null {
  const expandable = expandableRule(rule);
  const frame = zoneFrame(timeZone);
  const startMoment = readWall(start);
  const read = readOccurrenceWindow(window);

  if (
    expandable === null ||
    frame === null ||
    startMoment === null ||
    read === null
  ) {
    return null;
  }

  const entries = readOptions(options, frame);

  if (entries === null) {
    return null;
  }

  const rdate = placeEntries(entries.rdate, frame, entries.policy);
  const exdate = placeEntries(entries.exdate, frame, entries.policy);

  return {
    rule: expandable.rule,
    start: startMoment,
    frame,
    window: read,
    policy: entries.policy,
    until: expandable.until,
    excludedInstants: new Set(exdate.map(({ instant }) => instant)),
    rdate,
    refused: isRefused(entries.policy, frame, startMoment, [
      ...rdate,
      ...exdate,
    ]),
  };
}

/**
 * Expand a recurrence rule into its occurrences inside a window, in a time zone.
 *
 * DTSTART is `start`, a wall time in `timeZone`. The rule is expanded over wall times
 * (RFC 5545 §3.3.10, RFC 8984 §4.3.3.1) and each wall time is placed in the zone:
 *
 * - DTSTART is always the first occurrence and counts toward `COUNT`, even when it does not match
 *   the rule or is after `UNTIL`.
 * - `COUNT` counts wall times before any are placed, so a wall time the zone skips still counts,
 *   and two that land on one instant (a skipped 02:00 and the 03:00 after it) are one row, the
 *   earlier wall time's.
 * - `UNTIL` is a UTC instant and inclusive; it limits the rule, not `rdate`.
 * - `rdate` adds occurrences and `exdate` removes them. An entry with an offset or `Z` is an exact
 *   instant, an entry without one is a wall time in `timeZone`. A wall-time `exdate` names the
 *   instant that wall time takes under `disambiguation`, as a wall-time `rdate` does, and removes
 *   the occurrence at that instant. An `rdate` or `exdate` that is a date, a period or has
 *   fractional seconds returns `[]`, and so does a `start`, `rdate` or `exdate` with a bracketed
 *   annotation (`[Europe/Paris]`), which would name a second zone.
 * - A skipped or repeated wall time takes the instant `disambiguation` names: `"compatible"`
 *   (default; the earlier of a repeat, the later of a skip), `"earlier"`, `"later"`, or `"reject"`,
 *   which runs the call as `"compatible"` and then returns `[]` when `start`, a wall-time `rdate`
 *   or `exdate` entry (wherever it falls), or the wall time of a returned occurrence is skipped or
 *   repeated. Occurrences outside the window do not count, and an entry with an offset or `Z`
 *   never refuses.
 * - An occurrence past the range Temporal holds (up to `+275760-09-13T00:00:00Z`, from
 *   `-271821-04-20T00:00:00Z`) is left out, not an error.
 * - The window is an interval (`start` up to but not including `end`) or the first `count`
 *   occurrences after an instant (1 to 10,000).
 * - `timeZone` is a time zone identifier or a fixed offset (`+05:30`, `-00:44:30`).
 *
 * Returns `[]` for an invalid argument and for a result of more than 10,000 rows. A
 * `{ after, count }` call for a rule with fewer than `count` occurrences returns the ones it has,
 * as a `COUNT`-limited rule does: `FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30` gives DTSTART alone. A
 * rule from `YEARLY` to `DAILY` finds up to `count` occurrences however rarely it matches, as far
 * as Temporal's date range reaches. An `HOURLY`, `MINUTELY` or `SECONDLY` rule with a large
 * `INTERVAL` costs one scan of at most 86,400 steps to learn which times of day its steps can
 * land on, then one unit per row and per passing day. So `FREQ=MINUTELY;INTERVAL=7;BYHOUR=3;BYMINUTE=0`
 * fills a window of 10,000 rows, and a sub-daily rule that never matches again gives DTSTART alone.
 * `[]` also comes back when the work budget of 2,000,000 units runs out. A `COUNT` rule counts its
 * occurrences from DTSTART, about two units each, so a window that opens about 1,000,000
 * occurrences after DTSTART (740,000 for `SECONDLY`) gets `[]`: `FREQ=DAILY;COUNT=2000000` from
 * 2024-01-01 gives nothing after 4761-11-20.
 *
 * Complexity: O(W + K log K) for W the work the expansion spends, bounded by 2,000,000 units, and
 * K the rows kept, at most 10,000. A rule that matches rarely pays one unit for each year it
 * crosses, not one for each day, after at most 146,097 units to learn the 400-year calendar.
 * With no `COUNT` the cost follows the window, not the distance from DTSTART.
 *
 * @param rule a recurrence rule, from `parseRecurrenceRule`
 * @param start DTSTART, an ISO date-time without offset or sub-second part
 * @param timeZone an IANA time zone or fixed offset
 * @param window the interval or `{ after, count }` to expand
 * @param options extra and removed occurrences, and how a skipped or repeated wall time is placed
 * @returns the occurrences in ascending instant order, or `[]`
 *
 * @example expandRecurrence({ frequency: "daily", interval: 1, firstDayOfWeek: 1, count: 2 }, "2024-03-09T02:30:00", "America/New_York", { start: "2024-03-10T00:00:00Z", end: "2024-03-11T00:00:00Z" }) // [{ local: "2024-03-10T02:30:00", instant: "2024-03-10T07:30:00Z", classification: "nonexistent", earlier: "2024-03-10T06:30:00Z", later: "2024-03-10T07:30:00Z" }]
 * @example expandRecurrence(parseRecurrenceRule("FREQ=DAILY;COUNT=2"), "2024-03-09T02:30:00", "America/New_York", { start: "2024-01-01T00:00:00Z", end: "2025-01-01T00:00:00Z" }).map((row) => row.instant) // ["2024-03-09T07:30:00Z", "2024-03-10T07:30:00Z"]
 * @example expandRecurrence(parseRecurrenceRule("FREQ=DAILY"), "2024-01-01T09:00:00", "UTC", { after: "2024-01-01T09:00:00Z", count: 1 }).map((row) => row.local) // ["2024-01-02T09:00:00"]
 * @example expandRecurrence(parseRecurrenceRule("FREQ=DAILY;COUNT=2"), "2024-11-02T01:30:00", "America/New_York", { after: "2024-01-01T00:00:00Z", count: 5 }, { disambiguation: "reject" }) // [] (01:30 repeats on November 3)
 * @example expandRecurrence(parseRecurrenceRule("FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30"), "2024-01-01T09:00:00", "UTC", { after: "2024-01-01T00:00:00Z", count: 1 }).map((row) => row.instant) // ["2024-01-01T09:00:00Z"] (DTSTART is the only occurrence)
 * @example expandRecurrence(parseRecurrenceRule("FREQ=DAILY;COUNT=1"), "2024-06-01T12:00:00", "America/New_York", { after: "2024-01-01T00:00:00Z", count: 5 }, { rdate: ["2024-06-05T12:00:00[Europe/Paris]"] }) // [] (an annotation is not read)
 */
export function expandRecurrence(
  rule: RecurrenceRule,
  start: string,
  timeZone: string,
  window: OccurrenceWindow,
  options?: ExpandRecurrenceOptions,
): RecurrenceOccurrence[] {
  try {
    const call = readCall(rule, start, timeZone, window, options);

    if (call === null) {
      return [];
    }

    const collector = createCollector(call.window);

    if (call.refused) {
      return [];
    }

    addEntryRows(call, collector);

    if (!collectGenerated(call, collector)) {
      return [];
    }

    return finish(collector.rows, call.window) ?? [];
  } catch {
    return [];
  }
}
