import { Temporal } from "@js-temporal/polyfill";
import type { FiscalPattern } from "../types";

/** Weeks per period within one quarter, by pattern. */
const WEEKS_PER_PERIOD: Record<FiscalPattern, readonly number[]> = {
  "4-5-4": [4, 5, 4],
  "4-4-5": [4, 4, 5],
  "5-4-4": [5, 4, 4],
};

/** Periods in a fiscal year — four quarters of three periods each. */
const PERIODS_PER_YEAR = 12;

/** Days in a 52-week fiscal year. */
const DAYS_IN_52_WEEK_YEAR = 364;

/** Days in a 53-week fiscal year. */
const DAYS_IN_53_WEEK_YEAR = 371;

/**
 * Calendar-year offsets searched for the fiscal year end that bounds a date.
 *
 * A year end sits within three days of its rule's month-day, so it can fall in the calendar
 * year either side of the one it is named for. Both outer offsets are reachable when the
 * rule's month-day is within three days of January 1: `-1` when a year end lands in early
 * January, `+2` when one lands in late December and the date is the last days of a year.
 */
const YEAR_END_SEARCH_OFFSETS = [-1, 0, 1, 2];

/** Half the width of the 7-day window a "nearest weekday" year end can land in. */
const NEAREST_WEEKDAY_RADIUS = 3;

/** The three supported fiscal shapes, in the order the NRF documents them. */
const FISCAL_PATTERNS: readonly FiscalPattern[] = ["4-5-4", "4-4-5", "5-4-4"];

/** True when `value` is one of the three supported fiscal shapes. */
export function isFiscalPattern(value: unknown): value is FiscalPattern {
  return FISCAL_PATTERNS.includes(value as FiscalPattern);
}

/**
 * Return the fiscal year end falling in calendar year `year`, under the rule `anchor` states.
 *
 * The rule is "the <anchor's weekday> nearest to <anchor's month and day>", so the result is
 * `anchor`'s month and day in `year`, shifted at most three days either way onto `anchor`'s
 * weekday. A year end within three days of January 1 lands in the previous calendar year,
 * which is why callers must track the calendar-year argument rather than read `.year` back
 * off the result.
 */
export function fiscalYearEndIn(
  anchor: Temporal.PlainDate,
  year: number,
): Temporal.PlainDate {
  const target = anchor.with({ year });
  const weekdayDelta = anchor.dayOfWeek - target.dayOfWeek;
  // Map the -6..6 weekday delta onto the -3..3 nearest-occurrence shift.
  const shift =
    ((weekdayDelta + NEAREST_WEEKDAY_RADIUS + 7) % 7) - NEAREST_WEEKDAY_RADIUS;

  return target.add({ days: shift });
}

/**
 * Locate the fiscal year containing `date` under the rule `anchor` states.
 *
 * - The fiscal year is the one whose end is the first at or after `date`.
 * - `weeks` is derived from the gap between consecutive year ends — 52 or 53 — never assumed.
 * - Returns null when that gap is neither 364 nor 371 days, which no "nearest weekday" rule
 *   can produce and so only a corrupted anchor could reach.
 */
export function fiscalYearOf(
  date: Temporal.PlainDate,
  anchor: Temporal.PlainDate,
): { start: Temporal.PlainDate; weeks: number } | null {
  for (const offset of YEAR_END_SEARCH_OFFSETS) {
    const year = date.year + offset;
    const end = fiscalYearEndIn(anchor, year);

    if (Temporal.PlainDate.compare(end, date) < 0) continue;

    const start = fiscalYearEndIn(anchor, year - 1).add({ days: 1 });
    const days = start.until(end, { largestUnit: "day" }).days + 1;

    if (days !== DAYS_IN_52_WEEK_YEAR && days !== DAYS_IN_53_WEEK_YEAR) {
      return null;
    }

    return { start, weeks: days / 7 };
  }

  return null;
}

/**
 * Return the 1-based period holding `week` of a `weeks`-long fiscal year under `pattern`.
 *
 * The 53rd week, when the year has one, is appended to the final period — the NRF adds it
 * "to the end of the calendar", which turns a 4-5-4 year's last quarter into 4-5-5.
 */
export function fiscalPeriodOfWeek(
  week: number,
  weeks: number,
  pattern: FiscalPattern,
): number {
  const quarterShape = WEEKS_PER_PERIOD[pattern];
  let consumed = 0;

  for (let period = 1; period <= PERIODS_PER_YEAR; period++) {
    const isFinalPeriod = period === PERIODS_PER_YEAR;
    const extraWeek = isFinalPeriod && weeks === 53 ? 1 : 0;

    consumed += quarterShape[(period - 1) % quarterShape.length] + extraWeek;

    if (week <= consumed) return period;
  }

  return PERIODS_PER_YEAR;
}
