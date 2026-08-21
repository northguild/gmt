import { Temporal } from "@js-temporal/polyfill";

import { getLocaleFirstDayOfWeek, monthGridWeekRow } from "../../internal";
import { isValidDate } from "../validate";

/**
 * Return the number of calendar-grid rows (4, 5, or 6) `value`'s month
 * spans, using `locale`'s first day of week.
 *
 * - The count depends on which day the week starts — the same month can
 *   span 4, 5, or 6 rows depending on locale (e.g. February 2026 is 4
 *   rows starting Sunday but 5 rows starting Monday).
 * - Sized the same way `@internationalized/date`'s `getWeeksInMonth`
 *   sizes a datepicker's calendar grid.
 * - Resolves the locale's first day of week via
 *   `Intl.Locale.prototype.weekInfo`.
 * - Returns null if `value` or `locale` is invalid.
 *
 * @param value ISO PlainDate string
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR")
 * @returns number of week-rows the month spans (4-6), or null on invalid input
 *
 * @example getWeeksInMonth("2024-02-15", "en-US") // 5
 * @example getWeeksInMonth("2026-02-15", "en-US") // 4
 * @example getWeeksInMonth("2026-02-15", "en-GB") // 5
 * @example getWeeksInMonth("invalid", "en-US") // null
 */
export function getWeeksInMonth(value: string, locale: string): number | null {
  if (!isValidDate(value)) return null;

  const firstDay = getLocaleFirstDayOfWeek(locale);
  if (firstDay === null) return null;

  try {
    const date = Temporal.PlainDate.from(value);
    const firstOfMonth = date.with({ day: 1 });
    return monthGridWeekRow(firstOfMonth, firstDay, date.daysInMonth);
  } catch {
    return null;
  }
}
