import { Temporal } from "@js-temporal/polyfill";

import { getLocaleWeekYearBounds } from "../../internal";
import { isValidDate } from "../validate";

/**
 * Return the number of ISO weeks (52 or 53) in the ISO week-numbering year
 * containing `value`.
 *
 * - Uses `value`'s ISO week-numbering year (`Temporal.PlainDate.yearOfWeek`),
 *   not its calendar year — late-December/early-January dates can belong to
 *   a different ISO week-year than their calendar year (e.g. 2021-01-01 is
 *   ISO week-year 2020's week 53).
 * - Counted as the days from the week-year's week 1 (the Monday-started week
 *   holding January 4) to the next week-year's week 1, divided by 7. Computed
 *   by day arithmetic, so the dates at the range edges count too, although
 *   the neighbouring week 1 lies outside the representable range.
 * - Returns null on invalid input.
 *
 * @param value ISO PlainDate string
 * @returns 52 or 53, or null on invalid input
 *
 * @example getWeeksInYear("2024-06-15") // 52
 * @example getWeeksInYear("2020-06-15") // 53
 * @example getWeeksInYear("2021-01-01") // 53 (belongs to ISO week-year 2020)
 * @example getWeeksInYear("+275760-09-13") // 52 (the last PlainDate)
 * @example getWeeksInYear("invalid") // null
 */
export function getWeeksInYear(value: string): number | null {
  if (!isValidDate(value)) return null;

  try {
    // ISO 8601 week-numbering: weeks start on Monday and week 1 holds January 4 (4 of its days).
    const { startOffsetDays, endOffsetDays } = getLocaleWeekYearBounds(
      Temporal.PlainDate.from(value),
      1,
      4,
    );
    return (endOffsetDays - startOffsetDays) / 7;
  } catch {
    return null;
  }
}
