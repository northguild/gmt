import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../zoned/validate/isValidTimeZone";
import {
  isBusinessDate,
  parseBusinessCalendar,
  type ResolvedBusinessCalendar,
} from "./businessCalendar";
import { isObject } from "./isObject";
import { nextZonedBucketStart, zonedUnitStart } from "./zonedBucket";

/**
 * Local days a free-time walk may visit before giving up: the same cap as `bucketRange`. A
 * valid business calendar leaves at least one working day a week, so a working-day count needs
 * at most about seven local days per free or chargeable day. A walk that runs out answers with
 * the sentinel, never a partial ledger.
 */
export const MAX_WALKED_DAYS = 10_000;

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
  timeZone: string;
  firstDay: "eventDay" | "nextDay";
  calendar: ResolvedBusinessCalendar | null;
  chargeCalendar: ResolvedBusinessCalendar | null;
};

/**
 * Read a `FreeTimeOptions` bag, or `null` when it is not one: a non-object, an unknown `basis`
 * or `firstDay`, a missing `firstDay` (no default: the two conventions differ by a day of
 * charges), an invalid `timeZone`, or a `"working"` basis without a valid `BusinessCalendar`.
 * The `calendar` is read only when a basis that needs it is `"working"`.
 *
 * With `readChargeBasis`, `chargeBasis` is required too, and has no default for the same reason:
 * published tariffs mostly charge every calendar day after free time, but California law and
 * some tariffs charge working days only, and the two differ by the weekend.
 */
export function parseFreeTimeTerms(
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
  if (typeof timeZone !== "string" || !isValidTimeZone(timeZone)) {
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

/** One local date of the terminal: its first instant, and its ISO label. */
export interface LedgerDay {
  start: Temporal.ZonedDateTime;
  date: string;
}

/** What `walkFreeTime` returns: the free days, the expiry, and what the dwell used and owes. */
export interface FreeTimeLedger {
  /** The free days in order, exactly `freeDays` of them. */
  free: LedgerDay[];
  /** The first instant of the local day after the last free day; with no free days, of day one. */
  expiresAt: Temporal.ZonedDateTime;
  /** Free days the half-open dwell `[clockStart, clockEnd)` touched; `0` with no `clockEnd`. */
  used: number;
  /** Counted days from `expiresAt` that the dwell touched, in order; empty with no `clockEnd`. */
  charged: LedgerDay[];
}

/** The local day holding `zoned`, or `null` when its start cannot be found. */
function localDayOf(zoned: Temporal.ZonedDateTime): LedgerDay | null {
  const start = zonedUnitStart(zoned, "day");
  return start === null
    ? null
    : { start, date: start.toPlainDate().toString() };
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
      return { start: next, date: date.toString() };
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
 * - Returns `null` when the walk would visit more than `MAX_WALKED_DAYS` local days, when a day
 *   boundary cannot be found, or when the expiry lies past the last representable instant.
 */
export function walkFreeTime(
  clockStart: Temporal.ZonedDateTime,
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
  const counts = (day: LedgerDay): boolean =>
    terms.calendar === null ||
    isBusinessDate(day.start.toPlainDate(), terms.calendar);
  const charges = (day: LedgerDay): boolean =>
    terms.chargeCalendar === null ||
    isBusinessDate(day.start.toPlainDate(), terms.chargeCalendar);

  const free: LedgerDay[] = [];
  const charged: LedgerDay[] = [];
  let used = 0;
  let expiresAt: Temporal.ZonedDateTime | null = null;
  let expiryPending = false;
  let skipEventDay = terms.firstDay === "nextDay";

  let day = localDayOf(clockStart);
  if (day === null) {
    return null;
  }

  // One more visit than the cap: the day after the last touched one is what ends the walk.
  for (let i = 0; i <= MAX_WALKED_DAYS; i++) {
    const eventDaySkipped = skipEventDay;
    const counted = !skipEventDay && counts(day);
    skipEventDay = false;

    if (expiryPending) {
      expiresAt = day.start;
      expiryPending = false;
    } else if (expiresAt === null && counted) {
      if (freeDays === 0) {
        expiresAt = day.start;
      } else {
        free.push(day);
        if (touched(day)) used++;
        expiryPending = free.length === freeDays;
      }
    }

    if (expiresAt !== null) {
      // Free time has ended; with no clock end there is nothing more to lay out.
      if (last === undefined) {
        return { free, expiresAt, used, charged };
      }
      if (Temporal.ZonedDateTime.compare(day.start, last) > 0) {
        return { free, expiresAt, used, charged };
      }
      // The day of the event under `nextDay` is never charged: free time has not started on it.
      if (!eventDaySkipped && charges(day)) charged.push(day);
    }

    const next = nextLocalDay(day);
    if (next === undefined) {
      // No representable day follows: free time can still be laid out only if it has ended.
      return expiresAt === null ? null : { free, expiresAt, used, charged };
    }
    if (next === null) {
      return null;
    }
    day = next;
  }

  return null;
}
