import { Temporal } from "@js-temporal/polyfill";

import { getLocaleFirstDayOfWeek, monthGridWeekRow } from "../../internal";
import { isValidDate } from "../validate";

/**
 * Return the 1-based row `value` falls on within its month's calendar
 * grid, using `locale`'s first day of week.
 *
 * - Week 1 is the row containing the 1st of the month, even when that row
 *   is a partial week (matches date-fns's `getWeekOfMonth`, verified
 *   against date-fns source 2026-08-21) — this is the convention every
 *   calendar-grid UI (and `@internationalized/date`'s `getWeeksInMonth`)
 *   expects for sizing a month grid.
 * - Distinct from ISO `weekOfYear`: this counts rows within a single
 *   month's grid, reset every month, rather than weeks since Jan 1.
 * - Resolves the locale's first day of week via
 *   `Intl.Locale.prototype.weekInfo`.
 * - Returns null if `value` or `locale` is invalid.
 *
 * @param value ISO PlainDate string
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR")
 * @returns 1-based week-of-month row, or null on invalid input
 *
 * @example getWeekOfMonth("2024-02-01", "en-US") // 1
 * @example getWeekOfMonth("2024-02-29", "en-US") // 5
 * @example getWeekOfMonth("2026-02-01", "en-US") // 1
 * @example getWeekOfMonth("2026-02-01", "en-GB") // 1
 * @example getWeekOfMonth("invalid", "en-US") // null
 */
export function getWeekOfMonth(value: string, locale: string): number | null {
  if (!isValidDate(value)) return null;

  const firstDay = getLocaleFirstDayOfWeek(locale);
  if (firstDay === null) return null;

  try {
    const date = Temporal.PlainDate.from(value);
    const firstOfMonth = date.with({ day: 1 });
    return monthGridWeekRow(firstOfMonth, firstDay, date.day);
  } catch {
    return null;
  }
}
