// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
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
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR"), or a preference list of tags (ECMA-402; the first with locale data is read). Required: omitted, or an empty list (which ECMA-402 would resolve to the host default), returns null
 * @returns number of week-rows the month spans (4-6), or null on invalid input
 *
 * @example getWeeksInMonth("2024-02-15", "en-US") // 5
 * @example getWeeksInMonth("2026-02-15", "en-US") // 4
 * @example getWeeksInMonth("2026-02-15", "en-GB") // 5
 * @example getWeeksInMonth("-271821-04-19", "en-US") // 5 (the first representable month; its 1st lies before the range)
 * @example getWeeksInMonth("invalid", "en-US") // null
 * @example getWeeksInMonth("2024-06-15", ["en-US", "fr-FR"]) // 6
 */
export function getWeeksInMonth(
  value: string,
  locale: string | string[],
): number | null {
  if (!isValidDate(value)) return null;

  const firstDay = getLocaleFirstDayOfWeek(locale);
  if (firstDay === null) return null;

  try {
    const date = Temporal.PlainDate.from(value);
    // The 1st's weekday, counted back from the date rather than built with `with({ day: 1 })`:
    // the 1st of the first representable month (April -271821) lies before the range.
    const dayOfWeek = ((((date.dayOfWeek - date.day) % 7) + 7) % 7) + 1;
    return monthGridWeekRow({ dayOfWeek }, firstDay, date.daysInMonth);
  } catch {
    return null;
  }
}
