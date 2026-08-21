import { Temporal } from "@js-temporal/polyfill";

import {
  getLocaleFirstDayOfWeek,
  getLocaleMinimalDaysInFirstWeek,
  getLocaleWeekYearBounds,
} from "../../internal";
import { isValidDate } from "../validate";

/**
 * Return the locale-relative week-numbering year `value` belongs to,
 * using `locale`'s first day of week and minimal-days-in-first-week
 * (e.g. en-US: week 1 always contains Jan 1; ISO/most European locales:
 * week 1 always contains Jan 4).
 *
 * - Distinct from `value`'s calendar year, for the same reason
 *   `getWeekYear` is — late-December/early-January dates can belong to a
 *   different week-year than their calendar year, and the boundary
 *   depends on the locale's week-numbering rule.
 * - Distinct from `getWeekYear`: this uses the locale's first day of
 *   week and minimal-days rule (via `Intl.Locale.prototype.weekInfo`)
 *   instead of the fixed ISO rule (Monday-start, 4 minimal days) — the
 *   two can disagree on the same date near a year boundary.
 * - Resolves `locale`'s week-numbering rule via
 *   `Intl.Locale.prototype.weekInfo`.
 * - Returns null if `value` or `locale` is invalid.
 *
 * @param value ISO PlainDate string
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR")
 * @returns locale-relative week-numbering year, or null on invalid input
 *
 * @example getLocaleWeekYear("2024-06-15", "en-US") // 2024
 * @example getLocaleWeekYear("2022-01-01", "en-US") // 2022 (Jan 1 is always week 1 in en-US)
 * @example getLocaleWeekYear("2022-01-01", "de-DE") // 2021 (ISO-style: Jan 1, 2022 is a Saturday, in week 52 of 2021)
 * @example getLocaleWeekYear("invalid", "en-US") // null
 */
export function getLocaleWeekYear(
  value: string,
  locale: string,
): number | null {
  if (!isValidDate(value)) return null;

  const firstDay = getLocaleFirstDayOfWeek(locale);
  const minimalDays = getLocaleMinimalDaysInFirstWeek(locale);
  if (firstDay === null || minimalDays === null) return null;

  try {
    const date = Temporal.PlainDate.from(value);
    return getLocaleWeekYearBounds(date, firstDay, minimalDays).weekYear;
  } catch {
    return null;
  }
}
