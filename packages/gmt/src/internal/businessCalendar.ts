import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "../plain/validate/isValidDate";
import type { BusinessCalendar } from "../types";
import { isValidTimeZone } from "../zoned/validate/isValidTimeZone";

const ISO_WEEKDAYS = 7;

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

/** A `BusinessCalendar` reduced to the two lookups every walk needs. */
export type ResolvedBusinessCalendar = {
  weekend: Set<number>;
  holidays: Set<string>;
};

export const DEFAULT_BUSINESS_CALENDAR: ResolvedBusinessCalendar = {
  weekend: new Set(DEFAULT_WEEKEND),
  holidays: new Set<string>(),
};

function parseWeekend(weekend: unknown): Set<number> | null {
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

function parseHolidays(holidays: unknown): Set<string> | null {
  if (!Array.isArray(holidays)) {
    return null;
  }

  const dates = new Set<string>();

  try {
    for (const holiday of holidays) {
      if (typeof holiday !== "string" || !isValidDate(holiday)) {
        return null;
      }

      // Normalise through Temporal so a holiday and a walked date compare as the same string.
      dates.add(Temporal.PlainDate.from(holiday).toString());
    }
  } catch {
    return null;
  }

  return dates;
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
  if (
    typeof calendar !== "object" ||
    calendar === null ||
    Array.isArray(calendar)
  ) {
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

  return { weekend: weekendDays, holidays: holidayDates };
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

/** True when `date` is neither a weekend day nor a holiday in `calendar`. */
export function isBusinessDate(
  date: Temporal.PlainDate,
  calendar: ResolvedBusinessCalendar,
): boolean {
  return (
    !calendar.weekend.has(date.dayOfWeek) &&
    !calendar.holidays.has(date.toString())
  );
}

/*
 * The walks step whole days as integers — days since 1970-01-01 — rather than PlainDates: a walk
 * to the 200,000-day cap through the polyfill's `add`, `dayOfWeek` and `toString` took seconds.
 * Only the date a walk returns is built as a Temporal object.
 */

/**
 * TC39 `ISODateWithinLimits`: -271821-04-19 and +275760-09-13, counted in days from 1970-01-01,
 * are the first and last dates a PlainDate holds.
 */
const MIN_EPOCH_DAY = -100_000_001;
const MAX_EPOCH_DAY = 100_000_000;
/** 1970-01-01 was a Thursday, ISO weekday 4. */
const EPOCH_WEEKDAY_OFFSET = 3;
/** Days in a 400-year cycle of the proleptic Gregorian calendar. */
const DAYS_PER_400_YEARS = 146_097;
/** Days from 0000-03-01, the start of a March-based year, to 1970-01-01. */
const DAYS_FROM_MARCH_0000_TO_EPOCH = 719_468;
/** TC39 `PadISOYear`: years 0–9999 print with four digits, any other with a sign and six. */
const MAX_FOUR_DIGIT_YEAR = 9999;

/**
 * Days from 1970-01-01 to an ISO date, in the proleptic Gregorian calendar of ECMA-262 §21.4.1
 * that Temporal's ISO calendar extends. Years run from March so the leap day ends each one.
 */
function epochDayOf(year: number, month: number, day: number): number {
  const marchYear = month <= 2 ? year - 1 : year;
  const cycle = Math.floor(marchYear / 400);
  const yearOfCycle = marchYear - cycle * 400;
  const dayOfYear = Math.floor((153 * ((month + 9) % 12) + 2) / 5) + day - 1;
  const dayOfCycle =
    yearOfCycle * 365 +
    Math.floor(yearOfCycle / 4) -
    Math.floor(yearOfCycle / 100) +
    dayOfYear;

  return (
    cycle * DAYS_PER_400_YEARS + dayOfCycle - DAYS_FROM_MARCH_0000_TO_EPOCH
  );
}

/** The ISO year, month and day `epochDay` days from 1970-01-01 — `epochDayOf` inverted. */
function isoFieldsOf(epochDay: number): [number, number, number] {
  const shifted = epochDay + DAYS_FROM_MARCH_0000_TO_EPOCH;
  const cycle = Math.floor(shifted / DAYS_PER_400_YEARS);
  const dayOfCycle = shifted - cycle * DAYS_PER_400_YEARS;
  // Remove the leap days of every 4th, 100th and 400th year before dividing into 365-day years.
  const yearOfCycle = Math.floor(
    (dayOfCycle -
      Math.floor(dayOfCycle / 1460) +
      Math.floor(dayOfCycle / 36_524) -
      Math.floor(dayOfCycle / (DAYS_PER_400_YEARS - 1))) /
      365,
  );
  const dayOfYear =
    dayOfCycle -
    (365 * yearOfCycle +
      Math.floor(yearOfCycle / 4) -
      Math.floor(yearOfCycle / 100));
  const monthFromMarch = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthFromMarch + 2) / 5) + 1;
  const month = monthFromMarch < 10 ? monthFromMarch + 3 : monthFromMarch - 9;
  const year = yearOfCycle + cycle * 400 + (month <= 2 ? 1 : 0);

  return [year, month, day];
}

/** `Temporal.PlainDate#toString` for an ISO date, which is how `holidays` stores its dates. */
function isoDateString(epochDay: number): string {
  const [year, month, day] = isoFieldsOf(epochDay);
  const yearText =
    year < 0 || year > MAX_FOUR_DIGIT_YEAR
      ? `${year < 0 ? "-" : "+"}${String(Math.abs(year)).padStart(6, "0")}`
      : String(year).padStart(4, "0");

  return `${yearText}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Days from 1970-01-01 to `date`, an ISO-calendar date. Any other calendar throws a
 * `RangeError`, which callers turn into their sentinel: its year, month and day are not ISO
 * fields, so the arithmetic below would silently walk from the wrong day.
 */
function epochDayOfDate(date: Temporal.PlainDate): number {
  if (date.calendarId !== "iso8601") {
    throw new RangeError("business-day walks take an ISO-calendar date");
  }
  return epochDayOf(date.year, date.month, date.day);
}

function isBusinessEpochDay(
  epochDay: number,
  calendar: ResolvedBusinessCalendar,
): boolean {
  // `%` keeps the dividend's sign, so a date before 1970 needs the second `+ ISO_WEEKDAYS`.
  const weekday =
    ((((epochDay + EPOCH_WEEKDAY_OFFSET) % ISO_WEEKDAYS) + ISO_WEEKDAYS) %
      ISO_WEEKDAYS) +
    1;

  return (
    !calendar.weekend.has(weekday) &&
    (calendar.holidays.size === 0 ||
      !calendar.holidays.has(isoDateString(epochDay)))
  );
}

/** One day on from `epochDay`, throwing the `RangeError` `PlainDate#add` throws past a limit. */
function nextEpochDay(epochDay: number, direction: 1 | -1): number {
  const next = epochDay + direction;

  if (next < MIN_EPOCH_DAY || next > MAX_EPOCH_DAY) {
    throw new RangeError("date/time value is outside of supported range");
  }

  return next;
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
  let current = start;

  // `step` counts calendar days moved, exactly as it does in `stepBusinessDates`, so both
  // walks give up at the same distance — the 200,000 the public JSDoc quotes.
  for (let step = 0; step < MAX_BUSINESS_DAY_STEPS; step++) {
    if (isBusinessEpochDay(current, calendar)) {
      return dateAt(date, start, current);
    }

    current = nextEpochDay(current, direction);
  }

  return isBusinessEpochDay(current, calendar)
    ? dateAt(date, start, current)
    : null;
}

/**
 * Step `count` business days from `date` in `direction`, counting only days that are business
 * days in `calendar`.
 *
 * `date` is an ISO-calendar date, as every caller validates. `count` is a non-negative whole
 * number of business days. `date` itself is never counted, so a `count` of 0 returns `date`
 * unchanged even when it is not a business day. Returns `null`
 * when the walk exceeds `MAX_BUSINESS_DAY_STEPS`, and throws a `RangeError` when it passes a
 * Temporal range limit.
 */
export function stepBusinessDates(
  date: Temporal.PlainDate,
  direction: 1 | -1,
  count: number,
  calendar: ResolvedBusinessCalendar,
): Temporal.PlainDate | null {
  const start = epochDayOfDate(date);
  let current = start;
  let remaining = count;

  for (let step = 0; step < MAX_BUSINESS_DAY_STEPS && remaining > 0; step++) {
    current = nextEpochDay(current, direction);

    if (isBusinessEpochDay(current, calendar)) {
      remaining -= 1;
    }
  }

  return remaining === 0 ? dateAt(date, start, current) : null;
}
