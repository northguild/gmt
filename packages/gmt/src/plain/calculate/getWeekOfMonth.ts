// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";

import { getLocaleFirstDayOfWeek, monthGridWeekRow } from "../../internal";
import { isValidDate } from "../validate";

/**
 * Return the 1-based row `value` falls on within its month's calendar
 * grid, using `locale`'s first day of week.
 *
 * - Week 1 is the row containing the 1st of the month, even when that row
 *   is a partial week. This is GMT's own rule, not a standard's: a month
 *   grid draws every day of the month, so its first row always holds the 1st.
 * - Not CLDR's week-of-month field (`W`, UTS #35): that count applies the
 *   locale's `minDays`, so a short leading week may not count as part of
 *   the month.
 * - Comparison: date-fns's `getWeekOfMonth` returns the same number for the
 *   same first day of week.
 * - Distinct from ISO `weekOfYear`: this counts rows within a single
 *   month's grid, reset every month, rather than weeks since Jan 1.
 * - Resolves the locale's first day of week via
 *   `Intl.Locale.prototype.weekInfo`.
 * - Returns null if `value` or `locale` is invalid.
 *
 * @param value ISO PlainDate string
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR"), or a preference list of tags (ECMA-402; the first with locale data is read). Required: omitted, or an empty list (which ECMA-402 would resolve to the host default), returns null
 * @returns 1-based week-of-month row, or null on invalid input
 *
 * @example getWeekOfMonth("2024-02-01", "en-US") // 1
 * @example getWeekOfMonth("2024-02-29", "en-US") // 5
 * @example getWeekOfMonth("2026-02-01", "en-US") // 1
 * @example getWeekOfMonth("2026-02-01", "en-GB") // 1
 * @example getWeekOfMonth("-271821-04-30", "en-US") // 5 (the first representable month; its 1st lies before the range)
 * @example getWeekOfMonth("invalid", "en-US") // null
 * @example getWeekOfMonth("2024-05-12", ["fr-FR", "en-US"]) // 2
 */
export function getWeekOfMonth(
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
    return monthGridWeekRow({ dayOfWeek }, firstDay, date.day);
  } catch {
    return null;
  }
}
