import { zonelessCalendarDate } from "../../internal";
import { isOptionsArgument } from "../../internal/isObject";

/** Months in a quarter. */
const MONTHS_PER_QUARTER = 3;

/** Months in a year. */
const MONTHS_PER_YEAR = 12;

/**
 * Return the quarter `value` falls in, as a year and a quarter number.
 *
 * - With no options these are the calendar quarters: Q1 is January to March, and `year` is
 *   the calendar year.
 * - Labelling a fiscal year by the calendar year it starts in matches the NRF retail
 *   convention `getFiscalPeriod` uses. Organisations that label a fiscal year by the calendar
 *   year it *ends* in — the US federal government's October-start FY2025 begins in October
 *   2024 — should add one to `year`.
 * - `value` must be zoneless — an ISO date or datetime, as `isValidIsoDateLike` accepts. See
 *   `getIsoWeekDate` for why a moment is not accepted here.
 * - Returns null on invalid input, including a `fiscalYearStartMonth` that is not an integer
 *   from 1 to 12.
 *
 * @param value zoneless ISO 8601 date or datetime string (e.g. "2024-06-15")
 * @param optionsArg The month the fiscal year starts in
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
  optionsArg?: {
    /**
     * The month the year starts in, 1 (January) through 12, which makes the quarters fiscal
     * quarters. A date before it belongs to the previous fiscal year, so with `4` the date
     * `"2024-03-31"` is Q4 of 2023.
     *
     * @defaultValue `1`
     */
    fiscalYearStartMonth?: number;
  },
): {
  /**
   * The year the quarter belongs to. With `fiscalYearStartMonth` set, it is the calendar year the
   * fiscal year starts in, so a date before the start month reports the previous year.
   */
  year: number;
  /**
   * The quarter of that year, 1 through 4. Quarter 1 begins in the `fiscalYearStartMonth` month,
   * which is January by default.
   */
  quarter: number;
} | null {
  try {
    if (!isOptionsArgument(optionsArg)) {
      return null;
    }

    const fiscalYearStartMonth =
      optionsArg?.fiscalYearStartMonth === undefined
        ? 1
        : optionsArg.fiscalYearStartMonth;

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
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
