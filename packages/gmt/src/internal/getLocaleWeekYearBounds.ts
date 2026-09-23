import type { Temporal } from "@js-temporal/polyfill";

export interface LocaleWeekYearBounds {
  weekYear: number;
  /** Days from the source date to the first day of `weekYear`'s week 1 (0 or negative). */
  startOffsetDays: number;
  /** Days from the source date to the first day of `weekYear + 1`'s week 1 — exclusive (positive). */
  endOffsetDays: number;
}

/** Proleptic Gregorian leap year (ISO 8601-1:2019 §3.1.1.4 and §4.3.4). */
function daysInIsoYear(year: number): number {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return leap ? 366 : 365;
}

/** Weekday (1 = Monday .. 7 = Sunday) `days` after a day whose weekday is `dayOfWeek`. */
function shiftWeekday(dayOfWeek: number, days: number): number {
  return ((((dayOfWeek - 1 + days) % 7) + 7) % 7) + 1;
}

// Week 1 of a locale week-year always contains January's `minimalDays`-th
// day: the week starting on/before Jan 1 has k days in January, where k
// ranges from `minimalDays` (the threshold to still count as week 1) up
// to 7 (a full week starting exactly on Jan 1) — so day `minimalDays` of
// January falls within that range no matter which end it lands on. This
// generalizes ISO 8601's own rule (minimalDays = 4, so week 1 always
// contains Jan 4). Returned as days from January 1, given its weekday.
function week1StartFromJanuary1(
  january1DayOfWeek: number,
  firstDay: number,
  minimalDays: number,
): number {
  const anchorDayOfWeek = shiftWeekday(january1DayOfWeek, minimalDays - 1);
  return minimalDays - 1 - ((anchorDayOfWeek - firstDay + 7) % 7);
}

/**
 * Resolve the locale week-numbering year `date` belongs to, and the
 * `[start, end)` bounds of that week-year as day offsets from `date`, given a
 * locale's `firstDay` (1 = Monday .. 7 = Sunday) and `minimalDays` (the
 * minimum January days a week must have to count as week 1) — both from
 * `Intl.Locale.prototype.weekInfo`.
 *
 * Pure day arithmetic on `date`'s ISO fields: no neighbouring year's week 1 is
 * built as a date, because it can lie outside the representable range (week 1
 * of -271821 starts before `-271821-04-19`, week 1 of +275761 after
 * `+275760-09-13`) while `date` itself and its week-year are valid.
 *
 * Shared by `getLocaleWeekYear` (the year itself),
 * `getWeeksInLocaleWeekYear` and `getWeeksInYear` (the week count, derived
 * from the offsets).
 *
 * @example getLocaleWeekYearBounds(Temporal.PlainDate.from("2024-12-30"), 1, 4) // { weekYear: 2025, startOffsetDays: 0, endOffsetDays: 364 }
 */
export function getLocaleWeekYearBounds(
  date: Pick<Temporal.PlainDate, "year" | "dayOfYear" | "dayOfWeek">,
  firstDay: number,
  minimalDays: number,
): LocaleWeekYearBounds {
  const year = date.year;
  const january1 = 1 - date.dayOfYear;
  const january1DayOfWeek = shiftWeekday(date.dayOfWeek, january1);
  const weekYearStart = (yearJanuary1: number): number =>
    yearJanuary1 +
    week1StartFromJanuary1(
      shiftWeekday(january1DayOfWeek, yearJanuary1 - january1),
      firstDay,
      minimalDays,
    );

  const nextJanuary1 = january1 + daysInIsoYear(year);
  const start = weekYearStart(january1);
  const nextStart = weekYearStart(nextJanuary1);

  if (start > 0) {
    return {
      weekYear: year - 1,
      startOffsetDays: weekYearStart(january1 - daysInIsoYear(year - 1)),
      endOffsetDays: start,
    };
  }
  if (nextStart <= 0) {
    return {
      weekYear: year + 1,
      startOffsetDays: nextStart,
      endOffsetDays: weekYearStart(nextJanuary1 + daysInIsoYear(year + 1)),
    };
  }
  return { weekYear: year, startOffsetDays: start, endOffsetDays: nextStart };
}
