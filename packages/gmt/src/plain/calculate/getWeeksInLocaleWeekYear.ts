import { Temporal } from "@js-temporal/polyfill";

import {
  getLocaleFirstDayOfWeek,
  getLocaleMinimalDaysInFirstWeek,
  getLocaleWeekYearBounds,
} from "../../internal";
import { isValidDate } from "../validate";

/**
 * Return the number of weeks (52 or 53) in the locale week-numbering year
 * containing `value`, using `locale`'s first day of week and
 * minimal-days-in-first-week.
 *
 * - `getWeeksInYear`'s locale-relative counterpart — that function uses
 *   the fixed ISO rule, this one uses `locale`'s week-numbering rule
 *   (via `Intl.Locale.prototype.weekInfo`), and the two can disagree on
 *   the same date.
 * - Computed as the number of calendar days between the locale
 *   week-year's start and the next week-year's start, divided by 7 —
 *   always a whole number, since both bounds fall on the locale's first
 *   day of week.
 * - Returns null if `value` or `locale` is invalid.
 *
 * @param value ISO PlainDate string
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR")
 * @returns 52 or 53, or null on invalid input
 *
 * @example getWeeksInLocaleWeekYear("2024-06-15", "en-US") // 52
 * @example getWeeksInLocaleWeekYear("2020-06-15", "de-DE") // 53
 * @example getWeeksInLocaleWeekYear("invalid", "en-US") // null
 */
export function getWeeksInLocaleWeekYear(
  value: string,
  locale: string,
): number | null {
  if (!isValidDate(value)) return null;

  const firstDay = getLocaleFirstDayOfWeek(locale);
  const minimalDays = getLocaleMinimalDaysInFirstWeek(locale);
  if (firstDay === null || minimalDays === null) return null;

  try {
    const date = Temporal.PlainDate.from(value);
    const { start, end } = getLocaleWeekYearBounds(date, firstDay, minimalDays);
    const days = start.until(end, { largestUnit: "days" }).days;
    return days / 7;
  } catch {
    return null;
  }
}
