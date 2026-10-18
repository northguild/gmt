import { Temporal } from "./temporal";
import {
  businessDaysWithin,
  isBusinessDate,
  isBusinessEpochDay,
  parseBusinessCalendar,
  type ResolvedBusinessCalendar,
} from "./businessCalendar";
import {
  countWithin,
  epochDayOfDate,
  hasEpochDay,
  lowerBound,
} from "./epochDay";
import { NANOSECONDS_PER_DAY } from "./foreignEpochs";
import {
  MAX_EPOCH_NANOSECONDS,
  MIN_EPOCH_NANOSECONDS,
} from "./epochNanoseconds";
import { floorDivide } from "./floorDivide";
import { isObject } from "./isObject";
import {
  ensureTimeline,
  offsetOf,
  offsetTimeline,
  startOfDayNs,
  type OffsetTimeline,
} from "./offsetTimeline";
import { nextZonedBucketStart, zonedUnitStart } from "./zonedBucket";
import { frameEpochNanoseconds, zoneFrame, type ZoneFrame } from "./zoneFrame";
import { certainlyTouchesMoreBuckets } from "./zoneBucketCap";

/**
 * Local days a free-time walk may visit before giving up: the same cap as `bucketRange`. A
 * valid business calendar leaves at least one working day a week, so a working-day count needs
 * at most about seven local days per free or chargeable day. A walk that runs out answers with
 * the sentinel, never a partial ledger.
 */
const MAX_WALKED_DAYS = 10_000;

/**
 * Buckets stepped over while looking for a later date. A fall-back that re-enters the previous
 * date (`America/Goose_Bay`, 2010-11-07 00:01 back into the 6th) opens a one-minute 7 November
 * bucket, then a 6 November one, then 7 November again: two buckets in a row whose date is not
 * later than the day being left. One transition can do no more than that, so eight is a
 * generous bound.
 */
const MAX_REVISITED_BUCKETS = 8;

/**
 * The tariff terms reduced to what the walk reads. `calendar` is the working-day calendar free
 * days are counted against, `null` on the calendar basis; `chargeCalendar` is the one charged days
 * are counted against, `null` when every local day after expiry is charged.
 */
export type FreeTimeTerms = {
  /**
   * The counting zone as the caller wrote it: a time zone identifier or a stored UTC offset
   * (`±HH:MM[:SS]`), so always readable by `zoneFrame`. The walk's zoned values are placed with
   * `frameZoned` and turned back with `frameEpochNanoseconds` and `Temporal.Instant.fromEpochNanoseconds`.
   */
  timeZone: string;
  firstDay: "eventDay" | "nextDay";
  calendar: ResolvedBusinessCalendar | null;
  chargeCalendar: ResolvedBusinessCalendar | null;
};

/** `parseFreeTimeTerms` without the guard; every read of `options` happens here. */
function readFreeTimeTerms(
  options: unknown,
  readChargeBasis = false,
): FreeTimeTerms | null {
  if (!isObject(options)) {
    return null;
  }

  const { basis, chargeBasis, firstDay, timeZone, calendar } =
    options as Record<string, unknown>;

  const isBasis = (value: unknown): value is "calendar" | "working" =>
    value === "calendar" || value === "working";

  if (!isBasis(basis)) {
    return null;
  }
  if (readChargeBasis && !isBasis(chargeBasis)) {
    return null;
  }
  if (firstDay !== "eventDay" && firstDay !== "nextDay") {
    return null;
  }
  if (typeof timeZone !== "string" || zoneFrame(timeZone) === null) {
    return null;
  }

  const needsCalendar =
    basis === "working" || (readChargeBasis && chargeBasis === "working");
  const resolved = needsCalendar ? parseBusinessCalendar(calendar) : null;
  if (needsCalendar && resolved === null) {
    return null;
  }

  return {
    timeZone,
    firstDay,
    calendar: basis === "working" ? resolved : null,
    chargeCalendar:
      readChargeBasis && chargeBasis === "working" ? resolved : null,
  };
}

/**
 * Read a `FreeTimeOptions` bag, or `null` when it is not one: a non-object, an unknown `basis`
 * or `firstDay`, a missing `firstDay` (no default: the two conventions differ by a day of
 * charges), an invalid `timeZone`, or a `"working"` basis without a valid `BusinessCalendar`.
 * The `calendar` is read only when a basis that needs it is `"working"`.
 *
 * With `readChargeBasis`, `chargeBasis` is required too, and has no default for the same reason:
 * where free time is in working days, tariffs mostly charge every calendar day after it, but some
 * tariffs charge working days only, and the two differ by every closed day after expiry.
 */
export function parseFreeTimeTerms(
  options: unknown,
  readChargeBasis = false,
): FreeTimeTerms | null {
  try {
    return readFreeTimeTerms(options, readChargeBasis);
  } catch {
    // Never throws (Core Rule 3): a Proxy or getter that throws on access is invalid input.
    return null;
  }
}

/** A whole number of free days no smaller than `minimum`, or `null`. */
export function parseFreeDays(
  freeDays: unknown,
  minimum: 0 | 1,
): number | null {
  return typeof freeDays === "number" &&
    Number.isSafeInteger(freeDays) &&
    freeDays >= minimum
    ? freeDays
    : null;
}

/**
 * Read a `tiers` option: omitted means no bands, otherwise a strictly ascending list of positive
 * safe whole chargeable-day ordinals, each the last day of its band, with no holes. Anything
 * else is `null`.
 */
export function parseTiers(tiers: unknown): number[] | null {
  if (tiers === undefined) {
    return [];
  }
  if (!Array.isArray(tiers)) {
    return null;
  }

  // `Array.from` fills holes with `undefined`, which the check below rejects; `every` alone
  // would skip them and let `[5, , ]` through to a `NaN` band.
  const items = Array.from(tiers) as unknown[];
  const ascending = items.every(
    (tier, index) =>
      typeof tier === "number" &&
      Number.isSafeInteger(tier) &&
      tier >= 1 &&
      (index === 0 || tier > (items[index - 1] as number)),
  );

  return ascending ? (items as number[]) : null;
}

/**
 * Split `chargeable` days into the bands `tiers` describes: `[5, 10]` is days 1–5, 6–10 and 11
 * onward. Every band is listed, an empty one with `days: 0`, so a caller's rate table lines up
 * by index; the last band is always open (`to: null`).
 */
export function bandsByTier(
  tiers: number[],
  chargeable: number,
): { from: number; to: number | null; days: number }[] {
  const bands: { from: number; to: number | null; days: number }[] = [];
  let from = 1;

  for (const to of tiers) {
    bands.push({
      from,
      to,
      days: Math.max(0, Math.min(chargeable, to) - from + 1),
    });
    from = to + 1;
  }

  bands.push({ from, to: null, days: Math.max(0, chargeable - from + 1) });
  return bands;
}

/**
 * What a free-time walk returns, on epoch days (days from 1970-01-01, `epochDay.ts`) and epoch
 * nanoseconds, so the dwell's length costs no Temporal work: callers format the few values they
 * output.
 */
export interface FreeTimeLedger {
  /** The first free day; `null` with no free days. */
  firstFree: number | null;
  /** The last free day; `null` with no free days. */
  lastFree: number | null;
  /**
   * The first instant of the local day after the last free day (with no free days, of day one), in
   * epoch nanoseconds. It includes the frame's shift, so it is the real instant.
   */
  expiresAtNs: bigint;
  /** Free days the half-open dwell `[clockStart, clockEnd)` touched; `0` with no `clockEnd`. */
  used: number;
  /** Counted days from `expiresAt` that the dwell touched, ascending; empty with no `clockEnd`. */
  charged: number[];
}

/**
 * How near Temporal's limits a clock may sit before the walk steps day by day. The integer walk
 * reaches up to `MAX_WALKED_DAYS` dates out; this margin keeps every instant it asks a zone about
 * representable, so only the day-by-day walk has to answer for an expiry past the last instant.
 */
const LIMIT_MARGIN_NANOSECONDS =
  BigInt(MAX_WALKED_DAYS + 100) * NANOSECONDS_PER_DAY;

/** Days the offset timeline reads past the dwell before a search asks for more. */
const TIMELINE_LOOKAHEAD_DAYS = 14n;

/** What the integer walk knows: the zone's changes and the dates they delete. */
interface DateWalk {
  timeline: OffsetTimeline;
  terms: FreeTimeTerms;
  /** The local date of the clock start: visited index 0. */
  eventDay: number;
  /** Dates the zone deleted (`startOfDayNs(d) = startOfDayNs(d + 1)`), ascending, to `reachedDay`. */
  deleted: Int32Array;
  /** Dates up to here are complete in `deleted`. */
  reachedDay: number;
}

const floorDay = (ns: bigint): number =>
  Number(floorDivide(ns, NANOSECONDS_PER_DAY));

/**
 * The dates a zone deleted. Only a forward change can delete one: a date whose midnight lies in
 * the skipped wall clock, and whose next midnight is no later than the change's end, has no
 * instants (TC39 `GetStartOfDay` gives it and the next date the same start). `Pacific/Apia` skipped
 * 30 December 2011.
 */
function findDeletedDates(timeline: OffsetTimeline): Int32Array {
  const { changes, offsets } = timeline;
  const deleted: number[] = [];

  for (let index = 0; index < changes.length; index++) {
    if (offsets[index + 1] > offsets[index]) {
      const first = floorDay(changes[index] + offsets[index]);
      const last = floorDay(changes[index] + offsets[index + 1]);

      for (let day = first; day <= last; day++) {
        if (
          startOfDayNs(timeline, day) === startOfDayNs(timeline, day + 1) &&
          (deleted.length === 0 || day > deleted[deleted.length - 1])
        ) {
          deleted.push(day);
        }
      }
    }
  }

  return Int32Array.from(deleted);
}

/** Make `deleted` complete up to `day`; every query of a date calls this first. */
function reach(walk: DateWalk, day: number): void {
  if (day <= walk.reachedDay) {
    return;
  }

  ensureTimeline(walk.timeline, BigInt(day + 6) * NANOSECONDS_PER_DAY);

  const reachedDay = floorDay(walk.timeline.toNs) - 6;

  if (reachedDay !== walk.reachedDay) {
    walk.deleted = findDeletedDates(walk.timeline);
    walk.reachedDay = reachedDay;
  }
}

/** The first visited date after `day`: the next one the zone did not delete. */
function nextVisited(walk: DateWalk, day: number): number {
  let next = day + 1;

  reach(walk, next);

  while (hasEpochDay(walk.deleted, next)) {
    next++;
    reach(walk, next);
  }

  return next;
}

/** Visited dates in [from, to] that count against the free-time terms; 0 when from > to. */
function countedWithin(walk: DateWalk, from: number, to: number): number {
  if (from > to) {
    return 0;
  }

  reach(walk, to);

  const { calendar } = walk.terms;
  const { deleted } = walk;

  if (calendar === null) {
    return to - from + 1 - countWithin(deleted, from, to);
  }

  let count = businessDaysWithin(from, to, calendar);

  for (
    let index = lowerBound(deleted, from);
    index < deleted.length && deleted[index] <= to;
    index++
  ) {
    if (isBusinessEpochDay(deleted[index], calendar)) {
      count--;
    }
  }

  return count;
}

/**
 * The latest date whose visited index is at most `maxIndex`, or one past it when a deleted date
 * sits there: an upper bound for any visited date within the walk's cap.
 */
function lastDateWithin(walk: DateWalk, maxIndex: number): number {
  let day = walk.eventDay + maxIndex;

  for (;;) {
    reach(walk, day);

    const next =
      walk.eventDay + maxIndex + countWithin(walk.deleted, walk.eventDay, day);

    if (next === day) {
      return day;
    }

    day = next;
  }
}

/**
 * The visited date at which `n` counted dates have been seen, starting at `from`, or `null` when
 * that date's index passes `maxIndex`. Doubles its reach until the count is met, then bisects.
 */
function nthCountedDate(
  walk: DateWalk,
  from: number,
  n: number,
  maxIndex: number,
): number | null {
  let high = from + Math.ceil(n * 1.5) + 8;
  let capped = false;

  for (;;) {
    if (!capped && high > walk.eventDay + maxIndex) {
      high = lastDateWithin(walk, maxIndex);
      capped = true;
    }
    if (countedWithin(walk, from, high) >= n) {
      break;
    }
    if (capped) {
      return null;
    }
    high = from + 2 * (high - from);
  }

  let low = from;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if (countedWithin(walk, from, middle) >= n) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }

  return low;
}

/**
 * The latest date whose first instant is at or before `lastNs`. The first instant of a date never
 * decreases from one date to the next, so this bisects. Never earlier than the event day, so
 * `lastNs` must not precede the clock start (the callers guarantee it).
 */
function lastTouchedDate(walk: DateWalk, lastNs: bigint): number {
  const lastDay = floorDay(lastNs + offsetOf(walk.timeline, lastNs));
  let low = walk.eventDay;
  let high = lastDay + 3;

  reach(walk, high);

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);

    if (startOfDayNs(walk.timeline, middle) <= lastNs) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return low;
}

/** The visited dates in [from, to] that are charged, ascending. */
function chargedDates(walk: DateWalk, from: number, to: number): number[] {
  const charged: number[] = [];
  const { chargeCalendar } = walk.terms;

  reach(walk, to);

  for (let day = from; day <= to; day++) {
    if (
      (chargeCalendar === null || isBusinessEpochDay(day, chargeCalendar)) &&
      !hasEpochDay(walk.deleted, day)
    ) {
      charged.push(day);
    }
  }

  return charged;
}

/** The free-day span and expiry date: what the first part of the day-by-day walk finds. */
function freeSpan(
  walk: DateWalk,
  freeDays: number,
): {
  firstFree: number | null;
  lastFree: number | null;
  expiryDay: number;
} | null {
  const firstDay =
    walk.terms.firstDay === "nextDay"
      ? nextVisited(walk, walk.eventDay)
      : walk.eventDay;

  if (freeDays === 0) {
    const expiryDay = nthCountedDate(walk, firstDay, 1, MAX_WALKED_DAYS);

    return expiryDay === null
      ? null
      : { firstFree: null, lastFree: null, expiryDay };
  }

  // The last free day is one visit short of the cap: the expiry is the visit after it.
  const lastFree = nthCountedDate(
    walk,
    firstDay,
    freeDays,
    MAX_WALKED_DAYS - 1,
  );

  return lastFree === null
    ? null
    : {
        firstFree: nthCountedDate(walk, firstDay, 1, MAX_WALKED_DAYS - 1),
        lastFree,
        expiryDay: nextVisited(walk, lastFree),
      };
}

/**
 * `walkFreeTime` on dates, without a Temporal object per day; `undefined` when the day-by-day walk
 * has to answer. The visited dates are the dates from the event day on, each once, without those
 * the zone deleted (`findDeletedDates`); a free day, the expiry and the touched days are all read
 * from them, by counting and bisecting (the rules are in the day-by-day walk's description).
 */
function walkFreeTimeByDate(
  clockStart: Temporal.ZonedDateTime,
  frame: ZoneFrame,
  freeDays: number,
  terms: FreeTimeTerms,
  clockEnd: Temporal.ZonedDateTime | undefined,
): FreeTimeLedger | null | undefined {
  const startNs = frameEpochNanoseconds(clockStart, frame);
  // The last instant the dwell occupies: one nanosecond before its end, or the end of an empty dwell.
  let lastNs: bigint | undefined;

  if (clockEnd !== undefined) {
    lastNs = frameEpochNanoseconds(clockEnd, frame);
    if (Temporal.ZonedDateTime.compare(clockStart, clockEnd) < 0) {
      lastNs -= 1n;
    }
  }

  const high = lastNs === undefined || lastNs < startNs ? startNs : lastNs;

  // Too near Temporal's limits for the integer walk.
  if (
    startNs - LIMIT_MARGIN_NANOSECONDS < MIN_EPOCH_NANOSECONDS ||
    high + LIMIT_MARGIN_NANOSECONDS > MAX_EPOCH_NANOSECONDS
  ) {
    return undefined;
  }

  // The dwell certainly touches more dates than the cap; only a dwell long enough to need the
  // zone's changes counted is asked.
  if (
    clockEnd !== undefined &&
    lastNs !== undefined &&
    lastNs - startNs > BigInt(MAX_WALKED_DAYS - 2) * NANOSECONDS_PER_DAY &&
    certainlyTouchesMoreBuckets(clockStart, clockEnd, "day", MAX_WALKED_DAYS)
  ) {
    return null;
  }

  const eventDayStart = localDayOf(clockStart);
  if (eventDayStart === null) {
    return null;
  }

  const timeline = offsetTimeline(
    frame,
    startNs - 6n * NANOSECONDS_PER_DAY,
    high + TIMELINE_LOOKAHEAD_DAYS * NANOSECONDS_PER_DAY,
  );
  const eventDay = floorDay(startNs + offsetOf(timeline, startNs));
  const walk: DateWalk = {
    timeline,
    terms,
    eventDay,
    deleted: new Int32Array(0),
    reachedDay: Number.NEGATIVE_INFINITY,
  };

  reach(walk, eventDay);

  // The event day's own start is its first midnight unless the clock sits in a pass that
  // re-enters the date; the later dates then start after that pass, which only the day-by-day
  // walk lays out.
  if (
    frameEpochNanoseconds(eventDayStart.start, frame) !==
    startOfDayNs(timeline, eventDay)
  ) {
    return undefined;
  }

  const span = freeSpan(walk, freeDays);
  if (span === null) {
    return null;
  }

  const { firstFree, lastFree, expiryDay } = span;
  const touchedDay =
    lastNs === undefined ? undefined : lastTouchedDate(walk, lastNs);
  // The date the day-by-day walk would end on: the expiry when the dwell ends before it, else the
  // first date past the dwell. The walk answers `null` when its index is past the cap.
  const endDay =
    touchedDay === undefined || expiryDay > touchedDay
      ? expiryDay
      : nextVisited(walk, touchedDay);

  reach(walk, endDay);

  if (
    endDay - eventDay - countWithin(walk.deleted, eventDay, endDay - 1) >
    MAX_WALKED_DAYS
  ) {
    return null;
  }

  return {
    firstFree,
    lastFree,
    expiresAtNs: startOfDayNs(timeline, expiryDay),
    used:
      touchedDay === undefined || firstFree === null || lastFree === null
        ? 0
        : countedWithin(walk, firstFree, Math.min(lastFree, touchedDay)),
    charged:
      touchedDay === undefined || expiryDay > touchedDay
        ? []
        : chargedDates(walk, expiryDay, touchedDay),
  };
}

/** One local date of the terminal: its first instant, and its place on the calendar. */
interface LedgerDay {
  start: Temporal.ZonedDateTime;
  /** Days from 1970-01-01 of the day's local date. */
  epochDay: number;
  /**
   * True when the date began before the first instant Temporal represents, so `start` is the
   * clock start standing in for it. Such a start is never output: it can only anchor the walk.
   */
  clamped?: boolean;
}

/** The local day holding `zoned`, or `null` when its start cannot be found. */
function localDayOf(zoned: Temporal.ZonedDateTime): LedgerDay | null {
  let start: Temporal.ZonedDateTime | null;
  try {
    start = zonedUnitStart(zoned, "day");
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    // The event day began before Temporal's first instant (-271821-04-20T00:00Z in a zone west
    // of UTC). Its date is still known, and every later day boundary is representable, so the
    // clock start anchors the walk in its place.
    return {
      start: zoned,
      epochDay: epochDayOfDate(zoned.toPlainDate()),
      clamped: true,
    };
  }
  return start === null
    ? null
    : { start, epochDay: epochDayOfDate(start.toPlainDate()) };
}

/**
 * The first local day after `day` whose date is later than `day`'s. A bucket that re-enters an
 * earlier or equal date is folded into the day already laid out: a clock that starts in the
 * one-minute first pass of Goose Bay's 7 November must not free or charge the 6th, and
 * `countZonedLocalDates` counts a re-entered date once. `undefined` when the next day starts
 * past the last representable instant, `null` when the walk gives up.
 */
function nextLocalDay(day: LedgerDay): LedgerDay | null | undefined {
  const current = day.start.toPlainDate();
  let cursor = day.start;

  for (let i = 0; i < MAX_REVISITED_BUCKETS; i++) {
    let next: Temporal.ZonedDateTime | null;
    try {
      next = nextZonedBucketStart(cursor, "day");
    } catch (error) {
      if (error instanceof RangeError) return undefined;
      throw error;
    }
    if (next === null) {
      return null;
    }

    const date = next.toPlainDate();
    if (Temporal.PlainDate.compare(date, current) > 0) {
      return { start: next, epochDay: epochDayOfDate(date) };
    }
    cursor = next;
  }

  return null;
}

/**
 * Walk the terminal's real local days from the clock start and lay out free time and charges.
 *
 * Each day is a bucket `zonedUnitStart` / `nextZonedBucketStart` returns for `"day"`, the same
 * boundaries `floorToZone` and `bucketRange` use, so a 23- or 25-hour day is one day, a date the
 * zone deleted is never visited, and a date the clock falls back into is one day. Free days and
 * charged days are counted against their own terms: on a working basis a weekend day or holiday is
 * visited but not counted; on a calendar basis every day counts. The day of the event is neither
 * free nor charged under `"nextDay"`.
 *
 * - Free days are the first `freeDays` days counted on `calendar`. `expiresAt` is the start of the
 *   day after the last of them, whether or not that day counts; with `freeDays` of `0` it is the
 *   start of the first counted day.
 * - With a `clockEnd`, the dwell `[clockStart, clockEnd)` is half-open: a day is touched when it
 *   starts before `clockEnd`, and a zero-length dwell touches the day it sits on, as `dwellTime`
 *   counts. `used` is the free days touched; `charged` the days from `expiresAt` touched that count
 *   on `chargeCalendar`.
 * - An event day that began before the first representable instant is still walked from the
 *   clock start; only an expiry that would be that unrepresentable start is refused.
 * - Returns `null` when the walk would visit more than `MAX_WALKED_DAYS` local days, when a day
 *   boundary cannot be found, or when the expiry lies outside the representable range.
 *
 * This is the walk the integer form (`walkFreeTime`) answers for a clock near Temporal's limits
 * or in a pass that re-enters its date, where the day-by-day boundaries are the rule.
 */
function walkFreeTimeByDay(
  clockStart: Temporal.ZonedDateTime,
  frame: ZoneFrame,
  freeDays: number,
  terms: FreeTimeTerms,
  clockEnd?: Temporal.ZonedDateTime,
): FreeTimeLedger | null {
  // The dwell's last instant, one nanosecond before the exit; a zero-length dwell is its own point.
  const last =
    clockEnd === undefined
      ? undefined
      : Temporal.ZonedDateTime.compare(clockStart, clockEnd) < 0
        ? clockEnd.subtract({ nanoseconds: 1 })
        : clockEnd;
  const touched = (day: LedgerDay): boolean =>
    last !== undefined && Temporal.ZonedDateTime.compare(day.start, last) <= 0;
  const countsOn = (
    day: LedgerDay,
    calendar: ResolvedBusinessCalendar | null,
  ): boolean =>
    calendar === null || isBusinessDate(day.start.toPlainDate(), calendar);

  const charged: number[] = [];
  let firstFree: number | null = null;
  let lastFree: number | null = null;
  let freeSeen = 0;
  let used = 0;
  let expiresAtNs: bigint | null = null;
  let expiryPending = false;
  let skipEventDay = terms.firstDay === "nextDay";

  // A dwell that certainly touches more local days than the walk may visit ends it with the
  // sentinel anyway: the walk needs one visit for every day the dwell touches, and one more to
  // pass it. Deciding that from the span skips a 10,000-day walk. When it is not certain, the walk
  // runs as before, so no answer changes.
  if (
    clockEnd !== undefined &&
    certainlyTouchesMoreBuckets(clockStart, clockEnd, "day", MAX_WALKED_DAYS)
  ) {
    return null;
  }

  let day = localDayOf(clockStart);
  if (day === null) {
    return null;
  }

  // One more visit than the cap: the day after the last touched one is what ends the walk.
  for (let i = 0; i <= MAX_WALKED_DAYS; i++) {
    const eventDaySkipped = skipEventDay;
    const counted = !skipEventDay && countsOn(day, terms.calendar);
    skipEventDay = false;

    if (expiryPending) {
      expiresAtNs = frameEpochNanoseconds(day.start, frame);
      expiryPending = false;
    } else if (expiresAtNs === null && counted) {
      if (freeDays === 0) {
        // With no free time the expiry is day one's start, which must be a real instant.
        if (day.clamped) return null;
        expiresAtNs = frameEpochNanoseconds(day.start, frame);
      } else {
        firstFree ??= day.epochDay;
        lastFree = day.epochDay;
        if (touched(day)) used++;
        expiryPending = ++freeSeen === freeDays;
      }
    }

    if (expiresAtNs !== null) {
      // Free time has ended; with no clock end, or past the dwell, there is nothing more to lay out.
      if (
        last === undefined ||
        Temporal.ZonedDateTime.compare(day.start, last) > 0
      ) {
        return { firstFree, lastFree, expiresAtNs, used, charged };
      }
      // The day of the event under `nextDay` is never charged: free time has not started on it.
      if (!eventDaySkipped && countsOn(day, terms.chargeCalendar)) {
        charged.push(day.epochDay);
      }
    }

    const next = nextLocalDay(day);
    if (next === undefined) {
      // No representable day follows: free time can still be laid out only if it has ended.
      return expiresAtNs === null
        ? null
        : { firstFree, lastFree, expiresAtNs, used, charged };
    }
    if (next === null) {
      return null;
    }
    day = next;
  }

  return null;
}

/**
 * Lay out free time and charges from the clock start, in epoch days (see `FreeTimeLedger`).
 *
 * The local days of the terminal are the dates from the event day on, each once, without a date
 * the zone deleted. Free days are the first `freeDays` counted ones (every date on a calendar
 * basis, a working day of `calendar` otherwise); `expiresAt` is the first instant of the visited
 * date after the last of them, or with `freeDays` of `0` of the first counted one. With a
 * `clockEnd` the half-open dwell `[clockStart, clockEnd)` touches a date when it starts before
 * `clockEnd`, and a zero-length dwell touches the date it sits on, as `dwellTime` counts. `used` is
 * the free days touched, `charged` the dates from `expiresAt` touched that `chargeCalendar` charges.
 * The event day is neither free nor charged under `"nextDay"`.
 *
 * Counts come from closed forms over the zone's offset changes, so the dwell's length costs no
 * work per date. Returns `null` when the walk would visit more than `MAX_WALKED_DAYS` dates, when
 * a day boundary cannot be found, or when the expiry lies outside the representable range. A clock
 * within `MAX_WALKED_DAYS` dates of Temporal's limits, or in a pass that re-enters its date, is
 * laid out day by day (`walkFreeTimeByDay`).
 */
export function walkFreeTime(
  clockStart: Temporal.ZonedDateTime,
  freeDays: number,
  terms: FreeTimeTerms,
  clockEnd?: Temporal.ZonedDateTime,
): FreeTimeLedger | null {
  const frame = zoneFrame(terms.timeZone);

  if (frame === null) {
    return null;
  }

  const ledger = walkFreeTimeByDate(
    clockStart,
    frame,
    freeDays,
    terms,
    clockEnd,
  );

  if (ledger !== undefined) {
    return ledger;
  }

  return walkFreeTimeByDay(clockStart, frame, freeDays, terms, clockEnd);
}
