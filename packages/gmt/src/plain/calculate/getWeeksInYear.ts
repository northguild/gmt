import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";

/**
 * Return the number of ISO weeks (52 or 53) in the ISO week-numbering year
 * containing `value`.
 *
 * - Uses `value`'s ISO week-numbering year (`Temporal.PlainDate.yearOfWeek`),
 *   not its calendar year — late-December/early-January dates can belong to
 *   a different ISO week-year than their calendar year (e.g. 2021-01-01 is
 *   ISO week-year 2020's week 53).
 * - December 28 always falls in the ISO week-numbering year's final week
 *   (ISO week 1 always contains Jan 4, so Dec 28 — exactly 52 weeks after —
 *   is always in the last week), so its `weekOfYear` reports the year's
 *   total week count.
 * - Returns null on invalid input.
 *
 * @param value ISO PlainDate string
 * @returns 52 or 53, or null on invalid input
 *
 * @example getWeeksInYear("2024-06-15") // 52
 * @example getWeeksInYear("2020-06-15") // 53
 * @example getWeeksInYear("2021-01-01") // 53 (belongs to ISO week-year 2020)
 * @example getWeeksInYear("invalid") // null
 */
export function getWeeksInYear(value: string): number | null {
  if (!isValidDate(value)) return null;

  try {
    const date = Temporal.PlainDate.from(value);
    const yearOfWeek = date.yearOfWeek;
    if (yearOfWeek === undefined) return null;

    const lastWeekAnchor = Temporal.PlainDate.from({
      year: yearOfWeek,
      month: 12,
      day: 28,
    });
    return lastWeekAnchor.weekOfYear ?? null;
  } catch {
    return null;
  }
}
