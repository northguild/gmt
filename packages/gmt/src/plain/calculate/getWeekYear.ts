import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";

/**
 * Return the ISO 8601 week-numbering year `value` belongs to.
 *
 * - Distinct from `value`'s calendar year — late-December/early-January
 *   dates can belong to a different ISO week-year than their calendar
 *   year (e.g. 2024-12-30 is a Monday in ISO week 1 of **2025**).
 *   Pair this with `weekOfYearForDate` when bucketing by week: a week
 *   number alone is ambiguous without the week-year it belongs to.
 * - Uses `Temporal.PlainDate.yearOfWeek` (ISO weeks: Monday-start, week 1
 *   contains the year's first Thursday).
 * - Returns null on invalid input.
 *
 * @param value ISO PlainDate string
 * @returns ISO week-numbering year, or null on invalid input
 *
 * @example getWeekYear("2024-06-15") // 2024
 * @example getWeekYear("2024-12-30") // 2025 (Monday of ISO week 1, 2025)
 * @example getWeekYear("2021-01-01") // 2020 (belongs to ISO week 53 of 2020)
 * @example getWeekYear("invalid") // null
 */
export function getWeekYear(value: string): number | null {
  if (!isValidDate(value)) return null;

  try {
    const date = Temporal.PlainDate.from(value);
    return date.yearOfWeek ?? null;
  } catch {
    return null;
  }
}
