import { Temporal } from "../../internal/temporal";
import {
  fiscalYearLabel,
  gregorianCycleShift,
  zonelessCalendarDate,
} from "../../internal";
import { isOptionsArgument } from "../../internal/isObject";
import type { FiscalYearLabel } from "../../types";
import { isValidFiscalYearLabel } from "../validate";

/** Months in a quarter. */
const MONTHS_PER_QUARTER = 3;

/** Months in a year. */
const MONTHS_PER_YEAR = 12;

/**
 * Return the quarter `value` falls in, as a year and a quarter number.
 *
 * - With no options these are the calendar quarters: Q1 is January to March, and `year` is
 *   the calendar year.
 * - With `options`, these are fiscal quarters. The fiscal year starts on day 1 of
 *   `fiscalYearStartMonth`, and `yearLabel` names it: `"startYear"`, `"endYear"`, or
 *   `"majorityYear"` (the calendar year holding the most of its days). Both are required, and
 *   there is no default. Start months 1 to 7 put most days in the start year, and 8 to 12 put
 *   most in the end year.
 * - `value` must be zoneless — an ISO date or datetime, as `isValidIsoDateLike` accepts. See
 *   `getIsoWeekDate` for why a moment is not accepted here.
 * - Returns null on invalid input, including `options` without both fields, a
 *   `fiscalYearStartMonth` that is not an integer from 1 to 12, or an unrecognised `yearLabel`.
 *
 * @param value zoneless ISO 8601 date or datetime string (e.g. "2024-06-15")
 * @param optionsArg The fiscal year's start month and the rule that names it
 * @returns { year, quarter }, or null on invalid input
 *
 * @example getQuarter("2024-06-15") // { year: 2024, quarter: 2 }
 * @example getQuarter("2024-10-01") // { year: 2024, quarter: 4 }
 * @example getQuarter("2024-04-01", { fiscalYearStartMonth: 4, yearLabel: "startYear" }) // { year: 2024, quarter: 1 }
 * @example getQuarter("2024-03-31", { fiscalYearStartMonth: 4, yearLabel: "startYear" }) // { year: 2023, quarter: 4 } (the previous fiscal year)
 * @example getQuarter("2024-03-31", { fiscalYearStartMonth: 4, yearLabel: "endYear" }) // { year: 2024, quarter: 4 }
 * @example getQuarter("2023-10-15", { fiscalYearStartMonth: 7, yearLabel: "endYear" }) // { year: 2024, quarter: 2 }
 * @example getQuarter("2023-10-15", { fiscalYearStartMonth: 7, yearLabel: "majorityYear" }) // { year: 2023, quarter: 2 } (July to December is 184 of its days)
 * @example getQuarter("2024-10-01", { fiscalYearStartMonth: 10, yearLabel: "majorityYear" }) // { year: 2025, quarter: 1 }
 * @example getQuarter("2024-06-15", { fiscalYearStartMonth: 4 }) // null (no yearLabel)
 * @example getQuarter("2024-06-15", { fiscalYearStartMonth: 13, yearLabel: "startYear" }) // null
 * @example getQuarter("2024-06-15T12:00:00Z") // null (a moment, not a calendar date)
 * @example getQuarter("invalid") // null
 */
export function getQuarter(
  value: string,
  optionsArg?: {
    /**
     * The month the fiscal year starts in, 1 (January) through 12. A date before it belongs to
     * the previous fiscal year, so with `4` the date `"2024-03-31"` is in that year's Q4.
     */
    fiscalYearStartMonth: number;
    /** The calendar year that names a fiscal year. See `FiscalYearLabel`. */
    yearLabel: FiscalYearLabel;
  },
): {
  /**
   * The year that names the quarter's year: the calendar year with no `options`, otherwise the
   * one `yearLabel` picks.
   */
  year: number;
  /**
   * The quarter of that year, 1 through 4. Quarter 1 begins in January with no `options`, and
   * in the `fiscalYearStartMonth` month otherwise.
   */
  quarter: number;
} | null {
  try {
    if (optionsArg === undefined) {
      const date = zonelessCalendarDate(value);
      if (!date) return null;

      return {
        year: date.year,
        quarter: Math.floor((date.month - 1) / MONTHS_PER_QUARTER) + 1,
      };
    }

    if (!isOptionsArgument(optionsArg)) return null;

    // Read each option once: the value validated must be the value used.
    const fiscalYearStartMonth: unknown = optionsArg.fiscalYearStartMonth;
    const yearLabel: unknown = optionsArg.yearLabel;

    if (
      typeof fiscalYearStartMonth !== "number" ||
      !Number.isInteger(fiscalYearStartMonth) ||
      fiscalYearStartMonth < 1 ||
      fiscalYearStartMonth > MONTHS_PER_YEAR ||
      !isValidFiscalYearLabel(yearLabel)
    ) {
      return null;
    }

    const date = zonelessCalendarDate(value);
    if (!date) return null;

    const startYear =
      date.month < fiscalYearStartMonth ? date.year - 1 : date.year;
    // A fiscal year near Temporal's first or last date can run past it. Its label is calendar
    // arithmetic, so build it in the year 2000 to 2399 with the same leap pattern, then move
    // the label back.
    const shift = gregorianCycleShift(startYear);
    const start = Temporal.PlainDate.from({
      year: startYear - shift,
      month: fiscalYearStartMonth,
      day: 1,
    });
    const end = start.add({ years: 1 }).subtract({ days: 1 });
    const monthsIntoYear =
      (date.month - fiscalYearStartMonth + MONTHS_PER_YEAR) % MONTHS_PER_YEAR;

    return {
      year: fiscalYearLabel(start, end, yearLabel) + shift,
      quarter: Math.floor(monthsIntoYear / MONTHS_PER_QUARTER) + 1,
    };
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
