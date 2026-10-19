import type { Temporal } from "./temporal";
import { isoYearString } from "./isoYearString";

/** Days in an ISO week. */
export const ISO_WEEKDAYS = 7;

/**
 * TC39 `ISODateWithinLimits`: -271821-04-19 and +275760-09-13, counted in days from 1970-01-01,
 * are the first and last dates a PlainDate holds.
 */
export const MIN_EPOCH_DAY = -100_000_001;
export const MAX_EPOCH_DAY = 100_000_000;
/** 1970-01-01 was a Thursday, ISO weekday 4. */
const EPOCH_WEEKDAY_OFFSET = 3;
/** Days in a 400-year cycle of the proleptic Gregorian calendar. */
const DAYS_PER_400_YEARS = 146_097;
/** Days from 0000-03-01, the start of a March-based year, to 1970-01-01. */
const DAYS_FROM_MARCH_0000_TO_EPOCH = 719_468;

/**
 * Days from 1970-01-01 to an ISO date, in the proleptic Gregorian calendar of ECMA-262 §21.4.1
 * that Temporal's ISO calendar extends. Years run from March so the leap day ends each one.
 */
export function epochDayOf(year: number, month: number, day: number): number {
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
export function isoFieldsOf(epochDay: number): [number, number, number] {
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

/** `Temporal.PlainDate#toString` for an ISO date: the format `mergeCalendars` returns its holidays in. */
export function isoDateString(epochDay: number): string {
  const [year, month, day] = isoFieldsOf(epochDay);
  return `${isoYearString(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Days from 1970-01-01 to `date`, an ISO-calendar date. Any other calendar throws a
 * `RangeError`, which callers turn into their sentinel: its year, month and day are not ISO
 * fields, so the arithmetic below would silently walk from the wrong day.
 */
export function epochDayOfDate(date: Temporal.PlainDate): number {
  if (date.calendarId !== "iso8601") {
    throw new RangeError("business-day walks take an ISO-calendar date");
  }
  return epochDayOf(date.year, date.month, date.day);
}

/**
 * ISO weekday of an epoch day, Monday 1 to Sunday 7. Follows ECMA-262 `WeekDay` (day 0, 1970-01-01,
 * is a Thursday) renumbered as Temporal's `ISODayOfWeek` does, Sunday 7 rather than 0.
 */
export function isoWeekdayOf(epochDay: number): number {
  // `%` keeps the dividend's sign, so a date before 1970 needs the second `+ ISO_WEEKDAYS`.
  return (
    ((((epochDay + EPOCH_WEEKDAY_OFFSET) % ISO_WEEKDAYS) + ISO_WEEKDAYS) %
      ISO_WEEKDAYS) +
    1
  );
}

/** Index of the first element of `days` (sorted ascending) that is >= `epochDay`. */
export function lowerBound(days: Int32Array, epochDay: number): number {
  let low = 0;
  let high = days.length;

  while (low < high) {
    const middle = (low + high) >>> 1;

    if (days[middle] < epochDay) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

/** Members of `days` (sorted ascending) within [from, to]; 0 when from > to. */
export function countWithin(
  days: Int32Array,
  from: number,
  to: number,
): number {
  if (from > to) {
    return 0;
  }

  return lowerBound(days, to + 1) - lowerBound(days, from);
}

/** True when `epochDay` is a member of `days` (sorted ascending). */
export function hasEpochDay(days: Int32Array, epochDay: number): boolean {
  const index = lowerBound(days, epochDay);

  return index < days.length && days[index] === epochDay;
}

/**
 * `days` ascending with repeats removed. Returns `days` itself when it is already strictly
 * ascending, so a list written in date order costs one pass and no copy; otherwise sorts a copy
 * numerically.
 */
export function sortedUnique(days: Int32Array): Int32Array {
  let ascending = true;

  for (let index = 1; index < days.length; index++) {
    if (days[index] <= days[index - 1]) {
      ascending = false;
      break;
    }
  }

  if (ascending) {
    return days;
  }

  const sorted = days.slice().sort();
  let kept = 0;

  for (let index = 0; index < sorted.length; index++) {
    if (index === 0 || sorted[index] !== sorted[index - 1]) {
      sorted[kept++] = sorted[index];
    }
  }

  return sorted.slice(0, kept);
}
