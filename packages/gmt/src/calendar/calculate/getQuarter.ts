import { zonelessCalendarDate } from "../../internal";

/** Months in a quarter. */
const MONTHS_PER_QUARTER = 3;

/** Months in a year. */
const MONTHS_PER_YEAR = 12;

/**
 * Return the quarter `value` falls in, as a year and a quarter number.
 *
 * - `quarter` is 1–4. With no options these are the calendar quarters: Q1 is January to
 *   March, and `year` is the calendar year.
 * - `fiscalYearStartMonth` (1–12, default 1) moves the year's first month. A date before it
 *   belongs to the previous fiscal year, so `getQuarter("2024-03-31", { fiscalYearStartMonth:
 *   4 })` is Q4 of 2023.
 * - **`year` is the calendar year the fiscal year starts in**, matching the NRF retail
 *   convention `getFiscalPeriod` uses. Organisations that label a fiscal year by the calendar
 *   year it *ends* in — the US federal government's October-start FY2025 begins in October
 *   2024 — should add one.
 * - `value` must be zoneless — an ISO date or datetime, as `isValidIsoDateLike` accepts. See
 *   `getIsoWeekDate` for why a moment is not accepted here.
 * - Returns null on invalid input, including a `fiscalYearStartMonth` that is not an integer
 *   from 1 to 12.
 *
 * @param value zoneless ISO 8601 date or datetime string (e.g. "2024-06-15")
 * @param optionsArg optional: fiscalYearStartMonth (1-12, default 1)
 * @returns { year, quarter }, or null on invalid input
 *
 * @example getQuarter("2024-06-15") // { year: 2024, quarter: 2 }
 * @example getQuarter("2024-10-01") // { year: 2024, quarter: 4 }
 * @example getQuarter("2024-06-15", { fiscalYearStartMonth: 1 }) // { year: 2024, quarter: 2 } (the default, stated)
 * @example getQuarter("2024-04-01", { fiscalYearStartMonth: 4 }) // { year: 2024, quarter: 1 }
 * @example getQuarter("2024-03-31", { fiscalYearStartMonth: 4 }) // { year: 2023, quarter: 4 } (the previous fiscal year)
 * @example getQuarter("2024-06-15", { fiscalYearStartMonth: 13 }) // null
 * @example getQuarter("2024-06-15T12:00:00Z") // null (a moment, not a calendar date)
 * @example getQuarter("invalid") // null
 */
export function getQuarter(
  value: string,
  optionsArg?: { fiscalYearStartMonth?: number },
): { year: number; quarter: number } | null {
  const fiscalYearStartMonth = optionsArg?.fiscalYearStartMonth ?? 1;

  if (
    !Number.isInteger(fiscalYearStartMonth) ||
    fiscalYearStartMonth < 1 ||
    fiscalYearStartMonth > MONTHS_PER_YEAR
  ) {
    return null;
  }

  const date = zonelessCalendarDate(value);
  if (!date) return null;

  const monthsIntoYear =
    (date.month - fiscalYearStartMonth + MONTHS_PER_YEAR) % MONTHS_PER_YEAR;

  return {
    year: date.month < fiscalYearStartMonth ? date.year - 1 : date.year,
    quarter: Math.floor(monthsIntoYear / MONTHS_PER_QUARTER) + 1,
  };
}
