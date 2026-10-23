import { Temporal } from "./temporal";
import { isValidDate } from "../plain/validate/isValidDate";
import type { BusinessCalendar } from "../types";
import { isValidTimeZone } from "../zoned/validate/isValidTimeZone";
import { isObject } from "./isObject";
import {
  countWithin,
  epochDayOfDate,
  hasEpochDay,
  isoFieldsOf,
  ISO_WEEKDAYS,
  isoWeekdayOf,
  MAX_EPOCH_DAY,
  MIN_EPOCH_DAY,
  sortedUnique,
} from "./epochDay";

/**
 * The weekend GMT assumed before calendars existed: Saturday and Sunday, no holidays. It is
 * what `isBusinessDay`, `addBusinessDays` and `subtractBusinessDays` use when no calendar is
 * passed, so their shipped behaviour is unchanged.
 */
const DEFAULT_WEEKEND: readonly number[] = [6, 7];

/**
 * Calendar days a single business-day walk may step before giving up — roughly 547 years, far
 * past any real schedule. A walk that runs out returns the sentinel, never a partial answer.
 */
export const MAX_BUSINESS_DAY_STEPS = 200_000;

/** A `BusinessCalendar` reduced to the lookups every walk needs. */
export type ResolvedBusinessCalendar = {
  weekend: Set<number>;
  /** Every holiday as an epoch day, sorted ascending, no repeats. */
  holidays: Int32Array;
  /** The holidays that fall on a working weekday: the only ones that change a count. */
  closures: Int32Array;
};

/** Shared by every caller without a calendar: its arrays are empty and never mutated. */
export const DEFAULT_BUSINESS_CALENDAR: ResolvedBusinessCalendar = {
  weekend: new Set(DEFAULT_WEEKEND),
  holidays: new Int32Array(0),
  closures: new Int32Array(0),
};

export function parseWeekend(weekend: unknown): Set<number> | null {
  if (!Array.isArray(weekend)) {
    return null;
  }

  const everyDayInRange = weekend.every(
    (day) => Number.isInteger(day) && day >= 1 && day <= ISO_WEEKDAYS,
  );

  if (!everyDayInRange) {
    return null;
  }

  const days = new Set<number>(weekend as number[]);

  // All seven weekdays closed leaves no business day, so every walk would run to its cap.
  return days.size < ISO_WEEKDAYS ? days : null;
}

/** Most raw holiday strings the memo keeps before it starts over. */
const HOLIDAY_MEMO_LIMIT = 65_536;

/**
 * Raw holiday string to its epoch day. Only valid strings are stored: `isValidDate` and
 * `PlainDate.from` on an ISO string are pure functions of the string, so a hit is always
 * right and clearing the map costs speed, never correctness.
 */
const holidayMemo = new Map<string, number>();

/** Empty the holiday memo. Tests only. */
export function clearHolidayMemo(): void {
  holidayMemo.clear();
}

/** The epoch day of an ISO holiday string, or `null` when it is not one. */
export function holidayEpochDay(holiday: unknown): number | null {
  if (typeof holiday !== "string") {
    return null;
  }

  const known = holidayMemo.get(holiday);

  if (known !== undefined) {
    return known;
  }

  if (!isValidDate(holiday)) {
    return null;
  }

  const epochDay = epochDayOfDate(Temporal.PlainDate.from(holiday));

  if (holidayMemo.size >= HOLIDAY_MEMO_LIMIT) {
    holidayMemo.clear();
  }

  holidayMemo.set(holiday, epochDay);

  return epochDay;
}

/**
 * Reduce a holiday list to its epoch days, sorted ascending without repeats, or `null` when it
 * is not an array of ISO PlainDate strings. Shared with `OperatingSchedule.holidays`, which
 * takes the same list.
 */
export function parseHolidays(holidays: unknown): Int32Array | null {
  if (!Array.isArray(holidays)) {
    return null;
  }

  // Grown element by element so a bad entry is rejected before any list-sized allocation.
  const days: number[] = [];

  try {
    for (let index = 0; index < holidays.length; index++) {
      const epochDay = holidayEpochDay(holidays[index]);

      if (epochDay === null) {
        return null;
      }

      days.push(epochDay);
    }
  } catch {
    return null;
  }

  return sortedUnique(Int32Array.from(days));
}

/**
 * Reduce a caller-supplied `BusinessCalendar` to its lookups, or `null` when it is not one.
 *
 * `undefined` is rejected here; `resolveBusinessCalendar` is the entry point that treats an
 * absent calendar as the default Saturday–Sunday week.
 */
export function parseBusinessCalendar(
  calendar: unknown,
): ResolvedBusinessCalendar | null {
  if (!isObject(calendar) || Array.isArray(calendar)) {
    return null;
  }

  const { weekend, holidays, timeZone } = calendar as Record<string, unknown>;

  if (typeof timeZone !== "string" || !isValidTimeZone(timeZone)) {
    return null;
  }

  const weekendDays = parseWeekend(weekend);
  const holidayDates = parseHolidays(holidays);

  if (weekendDays === null || holidayDates === null) {
    return null;
  }

  return resolveParts(weekendDays, holidayDates);
}

/**
 * Join a parsed weekend and a sorted, repeat-free holiday list into the lookups every walk
 * needs, filtering out the holidays that fall on a weekend day.
 */
export function resolveParts(
  weekend: Set<number>,
  holidays: Int32Array,
): ResolvedBusinessCalendar {
  const closures = holidays.filter((day) => !weekend.has(isoWeekdayOf(day)));

  return { weekend, holidays, closures };
}

/**
 * Resolve an optional calendar: absent means the default Saturday–Sunday week with no
 * holidays, anything else must be a valid `BusinessCalendar` or this returns `null`.
 */
export function resolveBusinessCalendar(
  calendar: BusinessCalendar | undefined,
): ResolvedBusinessCalendar | null {
  return calendar === undefined
    ? DEFAULT_BUSINESS_CALENDAR
    : parseBusinessCalendar(calendar);
}

/**
 * True when `date` is neither a weekend day nor a holiday in `calendar`. `date` must be an
 * ISO-calendar date: any other calendar throws a `RangeError`. Every caller passes a date it
 * parsed from an ISO string or took from `toPlainDate()` of a zoned string parsed the same way.
 */
export function isBusinessDate(
  date: Temporal.PlainDate,
  calendar: ResolvedBusinessCalendar,
): boolean {
  return isBusinessEpochDay(epochDayOfDate(date), calendar);
}

/*
 * The walks step whole days as integers — days since 1970-01-01 — rather than PlainDates: a walk
 * to the 200,000-day cap through the polyfill's `add`, `dayOfWeek` and `toString` took seconds.
 * Only the date a walk returns is built as a Temporal object.
 */

/** True when `epochDay` is neither a weekend day nor a holiday on a working weekday. */
export function isBusinessEpochDay(
  epochDay: number,
  calendar: ResolvedBusinessCalendar,
): boolean {
  return (
    !calendar.weekend.has(isoWeekdayOf(epochDay)) &&
    !hasEpochDay(calendar.closures, epochDay)
  );
}

/** Business days in [from, to] (epoch days, from <= to); 0 when from > to. */
export function businessDaysWithin(
  from: number,
  to: number,
  calendar: ResolvedBusinessCalendar,
): number {
  if (from > to) {
    return 0;
  }

  const days = to - from + 1;
  const wholeWeeks = Math.floor(days / ISO_WEEKDAYS);
  let count = wholeWeeks * (ISO_WEEKDAYS - calendar.weekend.size);

  // At most six days are left over once whole weeks are taken off.
  for (let day = from + wholeWeeks * ISO_WEEKDAYS; day <= to; day++) {
    if (!calendar.weekend.has(isoWeekdayOf(day))) {
      count += 1;
    }
  }

  return count - countWithin(calendar.closures, from, to);
}

/** The walked-to date; `date` itself when the walk never moved. */
function dateAt(
  date: Temporal.PlainDate,
  startEpochDay: number,
  epochDay: number,
): Temporal.PlainDate {
  if (epochDay === startEpochDay) {
    return date;
  }

  const [year, month, day] = isoFieldsOf(epochDay);

  return new Temporal.PlainDate(year, month, day);
}

/** Business days among the days `fromOffset` to `toOffset` away from `start` in `direction`. */
function businessDaysInOffsetRange(
  start: number,
  direction: 1 | -1,
  fromOffset: number,
  toOffset: number,
  calendar: ResolvedBusinessCalendar,
): number {
  return direction === 1
    ? businessDaysWithin(start + fromOffset, start + toOffset, calendar)
    : businessDaysWithin(start - toOffset, start - fromOffset, calendar);
}

/**
 * The smallest distance `k` from `start`, at least `firstOffset`, whose span of days
 * `firstOffset`..`k` holds `target` business days; the walk reaches at most `MAX_BUSINESS_DAY_STEPS`
 * days out. Gives up as the day-by-day walk did: a `RangeError` when it would have stepped past a
 * Temporal limit first, `null` when it ran out of steps.
 */
function distanceToNthBusinessDay(
  start: number,
  direction: 1 | -1,
  firstOffset: number,
  target: number,
  calendar: ResolvedBusinessCalendar,
): number | null {
  const limitDistance =
    direction === 1 ? MAX_EPOCH_DAY - start : start - MIN_EPOCH_DAY;
  const lastOffset = Math.min(MAX_BUSINESS_DAY_STEPS, limitDistance);

  if (
    businessDaysInOffsetRange(
      start,
      direction,
      firstOffset,
      lastOffset,
      calendar,
    ) < target
  ) {
    if (MAX_BUSINESS_DAY_STEPS > limitDistance) {
      throw new RangeError("date/time value is outside of supported range");
    }

    return null;
  }

  let low = firstOffset;
  let high = lastOffset;

  // The count rises by at most one a day, so the smallest offset reaching `target` holds
  // exactly `target`.
  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if (
      businessDaysInOffsetRange(
        start,
        direction,
        firstOffset,
        middle,
        calendar,
      ) >= target
    ) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }

  return low;
}

/**
 * The first business day at or beyond `date`, walking in `direction`.
 *
 * `date` is an ISO-calendar date, as every caller validates. Returns `date` itself when it is
 * already a business day, and `null` when the walk exceeds `MAX_BUSINESS_DAY_STEPS`. Throws a
 * `RangeError` when the walk passes a Temporal range limit.
 */
export function businessDateFrom(
  date: Temporal.PlainDate,
  direction: 1 | -1,
  calendar: ResolvedBusinessCalendar,
): Temporal.PlainDate | null {
  const start = epochDayOfDate(date);
  const distance = distanceToNthBusinessDay(start, direction, 0, 1, calendar);

  return distance === null
    ? null
    : dateAt(date, start, start + direction * distance);
}

/**
 * First business day strictly after `epochDay`: the epoch-day form of `stepBusinessDates` with
 * a count of 1, so no `PlainDate` is built. Returns `null` when the walk exceeds
 * `MAX_BUSINESS_DAY_STEPS`; throws a `RangeError` when it passes a Temporal range limit.
 */
export function nextBusinessEpochDay(
  epochDay: number,
  calendar: ResolvedBusinessCalendar,
): number | null {
  const distance = distanceToNthBusinessDay(epochDay, 1, 1, 1, calendar);

  return distance === null ? null : epochDay + distance;
}

/**
 * Step `count` business days from `date` in `direction`, counting only days that are business
 * days in `calendar`.
 *
 * `date` is an ISO-calendar date, as every caller validates. `date` itself is never counted, so
 * a `count` of 0 returns `date` unchanged even when it is not a business day. Returns `null`
 * when the walk exceeds `MAX_BUSINESS_DAY_STEPS`, and for a `count` that is not a whole number
 * of days or is negative or NaN: a fractional or infinite `count` still walks first, as the
 * day-by-day loop did, so it throws the same `RangeError` when it passes a Temporal range limit
 * before finishing. Throws a `RangeError` when any walk passes a Temporal range limit.
 */
export function stepBusinessDates(
  date: Temporal.PlainDate,
  direction: 1 | -1,
  count: number,
  calendar: ResolvedBusinessCalendar,
): Temporal.PlainDate | null {
  const start = epochDayOfDate(date);

  if (count === 0) {
    return date;
  }

  // A negative or NaN count names no business day and walks nowhere.
  if (!(count > 0)) {
    return null;
  }

  // A fractional count names no date, but walks to its next whole number first: one that runs past
  // the range limit throws, as a whole count does.
  const distance = distanceToNthBusinessDay(
    start,
    direction,
    1,
    Math.ceil(count),
    calendar,
  );

  return distance === null || !Number.isInteger(count)
    ? null
    : dateAt(date, start, start + direction * distance);
}
