import { Temporal } from "@js-temporal/polyfill";

export interface LocaleWeekYearBounds {
  weekYear: number;
  /** First day of `weekYear`'s week 1. */
  start: Temporal.PlainDate;
  /** First day of `weekYear + 1`'s week 1 — an exclusive upper bound. */
  end: Temporal.PlainDate;
}

// Week 1 of a locale week-year always contains January's `minimalDays`-th
// day: the week starting on/before Jan 1 has k days in January, where k
// ranges from `minimalDays` (the threshold to still count as week 1) up
// to 7 (a full week starting exactly on Jan 1) — so day `minimalDays` of
// January falls within that range no matter which end it lands on. This
// generalizes ISO 8601's own rule (minimalDays = 4, so week 1 always
// contains Jan 4).
function startOfWeek1(
  year: number,
  firstDay: number,
  minimalDays: number,
): Temporal.PlainDate {
  const anchor = Temporal.PlainDate.from({
    year,
    month: 1,
    day: minimalDays,
  });
  const daysSinceFirstDay = (anchor.dayOfWeek - firstDay + 7) % 7;
  return anchor.subtract({ days: daysSinceFirstDay });
}

/**
 * Resolve the locale week-numbering year `date` belongs to, and the
 * `[start, end)` bounds (in calendar days) of that week-year, given a
 * locale's `firstDay` (1 = Monday .. 7 = Sunday) and `minimalDays` (the
 * minimum January days a week must have to count as week 1) — both from
 * `Intl.Locale.prototype.weekInfo`.
 *
 * Shared by `getLocaleWeekYear` (the year itself) and
 * `getWeeksInLocaleWeekYear` (the week count, derived from `start`/`end`).
 */
export function getLocaleWeekYearBounds(
  date: Temporal.PlainDate,
  firstDay: number,
  minimalDays: number,
): LocaleWeekYearBounds {
  let weekYear = date.year;
  let start = startOfWeek1(weekYear, firstDay, minimalDays);

  if (Temporal.PlainDate.compare(date, start) < 0) {
    weekYear -= 1;
    start = startOfWeek1(weekYear, firstDay, minimalDays);
  } else {
    const nextStart = startOfWeek1(weekYear + 1, firstDay, minimalDays);
    if (Temporal.PlainDate.compare(date, nextStart) >= 0) {
      weekYear += 1;
      start = nextStart;
    }
  }

  const end = startOfWeek1(weekYear + 1, firstDay, minimalDays);
  return { weekYear, start, end };
}
