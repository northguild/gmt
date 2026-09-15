import { dateFromFixed, fixedFromIso, mod } from "./fixedDay";
import type { ArithmeticModel, YearMonth } from "./nonIsoArithmetic";

/*
 * The arithmetic Hebrew calendar, from Dershowitz & Reingold, *Calendrical Calculations*
 * (3rd ed.), ch. 8 "The Hebrew Calendar": `hebrew-leap-year?`, `hebrew-calendar-elapsed-days`,
 * `hebrew-year-length-correction`, `hebrew-new-year`, `last-day-of-hebrew-month`,
 * `hebrew-from-fixed`. It is valid for every year, including years <= 0.
 *
 * WHY GMT OWNS IT (CORE-6 owner decision, Q4): in years <= 0 the runtime is wrong twice. The
 * polyfill's `inLeapYear` treats every year <= -1 as leap (D3, fixed upstream by
 * proposal-temporal 0df570c, not yet ported to js-temporal), and Node's ICU4C is a day off
 * (D4, fixed by ICU 5267bb5778 / ICU-23007, not yet in a Node release). Used only while one of
 * those probes fails, and only for Hebrew years <= 0.
 *
 * Remove when a js-temporal release ports 0df570c AND GMT's Node floor bundles an ICU with
 * 5267bb5778 (see README.md).
 */

/** Fixed day (R.D.) of Tishri 1, AM 1: `fixed-from-julian(3761 BCE, October 7)`. */
const HEBREW_EPOCH = -1_373_427;
/** Mean Hebrew year in days, used only to estimate the year before correcting it. */
const MEAN_YEAR_DAYS = 35_975_351 / 98_496;
/** The estimate is off by at most one year; a few extra steps cost nothing. */
const MAX_YEAR_ADJUSTMENTS = 4;

export interface HebrewFields {
  year: number;
  /** Ordinal month, Tishri = 1; in a leap year Adar I (`M05L`) is 6. */
  month: number;
  monthCode: string;
  day: number;
}

export function isHebrewLeapYear(year: number): boolean {
  return mod(7 * year + 1, 19) < 7;
}

/** Months from Tishri AM 1 to Tishri of `year` (`hebrew-calendar-elapsed-days`' month count). */
function monthsBeforeYear(year: number): number {
  return Math.floor((235 * year - 234) / 19);
}

function elapsedDays(year: number): number {
  const monthsElapsed = monthsBeforeYear(year);
  const partsElapsed = 12_084 + 13_753 * monthsElapsed;
  const days = 29 * monthsElapsed + Math.floor(partsElapsed / 25_920);
  return mod(3 * (days + 1), 7) < 3 ? days + 1 : days;
}

function yearLengthCorrection(year: number): number {
  const previous = elapsedDays(year - 1);
  const current = elapsedDays(year);
  const next = elapsedDays(year + 1);
  if (next - current === 356) {
    return 2;
  }
  return current - previous === 382 ? 1 : 0;
}

/** Fixed day (R.D.) of Tishri 1 of `year`. */
export function hebrewNewYear(year: number): number {
  return HEBREW_EPOCH + elapsedDays(year) + yearLengthCorrection(year);
}

/** Month codes and lengths from Tishri, per `last-day-of-hebrew-month`. */
function monthsOfYear(year: number): readonly [string, number][] {
  const yearLength = hebrewNewYear(year + 1) - hebrewNewYear(year);
  const longHeshvan = yearLength === 355 || yearLength === 385;
  const shortKislev = yearLength === 353 || yearLength === 383;
  const adar: [string, number][] = isHebrewLeapYear(year)
    ? [
        ["M05L", 30],
        ["M06", 29],
      ]
    : [["M06", 29]];
  return [
    ["M01", 30],
    ["M02", longHeshvan ? 30 : 29],
    ["M03", shortKislev ? 29 : 30],
    ["M04", 29],
    ["M05", 30],
    ...adar,
    ["M07", 30],
    ["M08", 29],
    ["M09", 30],
    ["M10", 29],
    ["M11", 30],
    ["M12", 29],
  ];
}

function fieldsInYear(year: number, dayOfYear: number): HebrewFields {
  let remaining = dayOfYear;
  const months = monthsOfYear(year);
  for (const [index, [monthCode, length]] of months.entries()) {
    if (remaining < length) {
      return { year, month: index + 1, monthCode, day: remaining + 1 };
    }
    remaining -= length;
  }
  throw new RangeError(`Day ${dayOfYear} is past Hebrew year ${year}`);
}

/** The Hebrew year, ordinal month, month code and day of a fixed day (R.D.). */
export function hebrewFieldsFromFixed(fixed: number): HebrewFields {
  let year = Math.floor((fixed - HEBREW_EPOCH) / MEAN_YEAR_DAYS) + 1;
  for (let step = 0; step < MAX_YEAR_ADJUSTMENTS; step++) {
    const newYear = hebrewNewYear(year);
    if (newYear > fixed) {
      year -= 1;
    } else if (hebrewNewYear(year + 1) <= fixed) {
      year += 1;
    } else {
      return fieldsInYear(year, fixed - newYear);
    }
  }
  throw new RangeError(`Hebrew year of fixed day ${fixed} did not converge`);
}

function monthIndex({ year, month }: YearMonth): number {
  return monthsBeforeYear(year) + month - 1;
}

function yearMonthAt(index: number): YearMonth {
  let year = Math.floor((19 * index) / 235) + 1;
  for (let step = 0; step < MAX_YEAR_ADJUSTMENTS; step++) {
    if (monthsBeforeYear(year) > index) {
      year -= 1;
    } else if (monthsBeforeYear(year + 1) <= index) {
      year += 1;
    } else {
      return { year, month: index - monthsBeforeYear(year) + 1 };
    }
  }
  throw new RangeError(`Hebrew year of month ${index} did not converge`);
}

/**
 * The Hebrew calendar as an integer arithmetic model for `nonIsoArithmetic.ts`, so add and until
 * are correct for years <= 0 too (D3 + D4). Every answer is this file's arithmetic; nothing is
 * read from the runtime.
 */
export const hebrewArithmeticModel: ArithmeticModel = {
  calendarId: "hebrew",
  fields(date) {
    const iso = date.withCalendar("iso8601");
    return hebrewFieldsFromFixed(fixedFromIso(iso.year, iso.month, iso.day));
  },
  monthOrdinal(year, monthCode) {
    const index = monthsOfYear(year).findIndex(([code]) => code === monthCode);
    return index < 0 ? "missing" : index + 1;
  },
  addMonths: (start, months) => yearMonthAt(monthIndex(start) + months),
  monthsBetween: (from, to) => monthIndex(to) - monthIndex(from),
  daysInMonth: ({ year, month }) => monthsOfYear(year)[month - 1]?.[1] ?? null,
  toDate(year, month, day) {
    const months = monthsOfYear(year);
    const length = months[month - 1]?.[1] ?? 0;
    if (day < 1 || day > length) {
      throw new RangeError(`No Hebrew date ${year}-${month}-${day}`);
    }
    const daysBefore = months
      .slice(0, month - 1)
      .reduce((total, [, days]) => total + days, 0);
    return dateFromFixed(hebrewNewYear(year) + daysBefore + day - 1);
  },
};
