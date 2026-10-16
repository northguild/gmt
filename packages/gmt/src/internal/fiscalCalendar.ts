import { Temporal } from "@js-temporal/polyfill";
import type { FiscalExtraWeek, FiscalPattern, FiscalYearLabel } from "../types";

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

/**
 * Years in one cycle of the Gregorian leap rule. Every 400-year span has 146,097 days, a whole
 * number of weeks, and the same leap years in the same places, so moving a date by a multiple
 * of 400 years keeps its month, day and weekday.
 */
const GREGORIAN_CYCLE_YEARS = 400;

/** First year of the cycle that dates are moved into, well inside Temporal's range. */
const SAFE_CYCLE_START = 2000;

/**
 * Return the multiple of 400 years that moves `year` into 2000 to 2399, where it keeps its
 * place in the Gregorian cycle.
 *
 * Subtract the result to move a year into that cycle, and add it to move it back. Calendar
 * arithmetic near Temporal's first or last date (-271821-04-19, +275760-09-13) can step past
 * the range on the way to an answer that lies inside it; done in the safe cycle it cannot.
 *
 * @example gregorianCycleShift(2024) // 0
 * @example gregorianCycleShift(-271820) // -274000 (-271820 sits where 2180 does)
 * @example gregorianCycleShift(275760) // 273600 (275760 sits where 2160 does)
 */
export function gregorianCycleShift(year: number): number {
  const placeInCycle =
    ((year % GREGORIAN_CYCLE_YEARS) + GREGORIAN_CYCLE_YEARS) %
    GREGORIAN_CYCLE_YEARS;

  return year - SAFE_CYCLE_START - placeInCycle;
}

/**
 * Return the fiscal year end falling in calendar year `year`, under the rule `anchor` states.
 *
 * The rule is "the <anchor's weekday> nearest to <anchor's month and day>", so the result is
 * `anchor`'s month and day in `year`, shifted at most three days either way onto `anchor`'s
 * weekday. A year end within three days of January 1 lands in the previous calendar year,
 * which is why callers must track the calendar-year argument rather than read `.year` back
 * off the result.
 *
 * - The month-day is moved into `year` with Temporal's `overflow: "constrain"`, so a
 *   February 29 anchor targets February 28 in a common year before the weekday shift. A rule
 *   tied to the end of a month ("the last Saturday of February", or the Saturday nearest the
 *   month's last day) would instead put a February 28 anchor on February 29 in a leap year;
 *   this does not.
 */
export function fiscalYearEndIn(
  anchor: Temporal.PlainDate,
  year: number,
): Temporal.PlainDate {
  const target = anchor.with({ year }, { overflow: "constrain" });
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
 * - The search reads the year ends in the calendar years either side of `date`, so it throws
 *   RangeError when one of them lies outside Temporal's range. Near -271821-04-19 or
 *   +275760-09-13 that happens even when the date is valid. Move `date` into 2000 to 2399 with
 *   `gregorianCycleShift` first, then add the shift back to any year read off the result:
 *   whole 400-year cycles keep every month, day, weekday and day count.
 * - Returns null when the gap between year ends is neither 364 nor 371 days, which no
 *   "nearest weekday" rule can produce and so only a corrupted anchor could reach.
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
 * - The 53rd week, when the year has one, lengthens period 1 (`"firstPeriod"`) or period 12
 *   (`"lastPeriod"`), as `extraWeek` says. A 4-4-5 year then runs 5-4-5 … 4-4-5 or
 *   4-4-5 … 4-4-6.
 * - In a 52-week year `extraWeek` has no effect.
 */
export function fiscalPeriodOfWeek(
  week: number,
  weeks: number,
  pattern: FiscalPattern,
  extraWeek: FiscalExtraWeek,
): number {
  const quarterShape = WEEKS_PER_PERIOD[pattern];
  const longPeriod = extraWeek === "firstPeriod" ? 1 : PERIODS_PER_YEAR;
  let consumed = 0;

  for (let period = 1; period <= PERIODS_PER_YEAR; period++) {
    const added = weeks === 53 && period === longPeriod ? 1 : 0;

    consumed += quarterShape[(period - 1) % quarterShape.length] + added;

    if (week <= consumed) return period;
  }

  return PERIODS_PER_YEAR;
}

/**
 * Return the calendar year that names the fiscal year running `start` to `end`, both inclusive.
 *
 * - `"startYear"` is `start`'s year and `"endYear"` is `end`'s year.
 * - `"majorityYear"` is the calendar year holding the most of the fiscal year's days. Days are
 *   the unit because the fiscal year and the calendar year share no other: months differ in
 *   length, and a week can straddle 1 January.
 * - Every calendar year in the span is counted, not only the two end years. A 371-day year can
 *   touch three calendar years (2024-12-29 to 2026-01-03), and then the middle one wins.
 * - GMT rule: when two years hold exactly half the days each (182 and 182), the later one, the
 *   year holding the end date, wins, because IAS 1 ¶51(c) lets a reporting period be
 *   identified by the date it ends.
 */
export function fiscalYearLabel(
  start: Temporal.PlainDate,
  end: Temporal.PlainDate,
  label: FiscalYearLabel,
): number {
  if (label === "startYear") return start.year;
  if (label === "endYear") return end.year;

  let best = end.year;
  let bestDays = -1;

  for (let year = start.year; year <= end.year; year++) {
    const from =
      year === start.year
        ? start
        : Temporal.PlainDate.from({ year, month: 1, day: 1 });
    const to =
      year === end.year
        ? end
        : Temporal.PlainDate.from({ year, month: 12, day: 31 });
    const days = from.until(to, { largestUnit: "day" }).days + 1;

    // ">=": a tie goes to the later year, which holds the end date.
    if (days >= bestDays) {
      best = year;
      bestDays = days;
    }
  }

  return best;
}
