import { Temporal } from "@js-temporal/polyfill";

import {
  getLocaleFirstDayOfWeek,
  getLocaleWeekYearBounds,
  resolveMinimalDaysInFirstWeek,
} from "../../internal";
import { isValidDate } from "../validate";

/**
 * Return the locale-relative week-numbering year `value` belongs to, from `locale`'s first day of
 * week and a minimal-days-in-first-week rule.
 *
 * - Distinct from `value`'s calendar year, for the same reason `getWeekYear` is: late-December and
 *   early-January dates can belong to a neighbouring week-year.
 * - Week 1 is the week starting on `locale`'s first day of week that holds at least `minimalDays`
 *   days of January (UTS #35 Part 4, Week Data). The first day of week comes from
 *   `Intl.Locale.prototype.getWeekInfo`.
 * - **`minimalDays` defaults to `4`, the ISO 8601 rule, on every runtime.** ECMA-402 does not expose
 *   a locale's minimal days: Intl Locale Info returns only `firstDay` and `weekend`
 *   (tc39/proposal-intl-locale-info#86), so older runtimes that still reported it disagreed with
 *   newer ones about the same date. Pass CLDR's value when you need a locale's own rule: in CLDR 48
 *   `weekData`, the world default (`001`) is `1` — week 1 always contains January 1, as in `US`,
 *   `CA`, `MX`, `JP` and `CN` — and `4` is set for a list of mostly European regions such as `GB`,
 *   `DE` and `FR`, where it matches this default.
 * - Returns null if `value` or `locale` is invalid, or if `minimalDays` is not an integer from 1 to 7.
 * - **Compatibility:** before 1.16.0 the default read the runtime's `minimalDays` where one was
 *   exposed (Node 22), so a locale such as `en-US` got `1` there and `4` on Node 24 and later. Pass
 *   `{ minimalDays: 1 }` to keep the Node 22 result for such a locale on every runtime.
 *
 * @param value ISO PlainDate string
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR")
 * @param options optional: minimalDays (integer 1–7, default 4)
 * @returns locale-relative week-numbering year, or null on invalid input
 *
 * @example getLocaleWeekYear("2024-06-15", "en-US") // 2024
 * @example getLocaleWeekYear("2022-01-01", "en-US", { minimalDays: 1 }) // 2022 — Jan 1 is always in week 1
 * @example getLocaleWeekYear("2022-01-01", "en-US") // 2021 — ISO default: the week of Dec 26 holds 1 day of 2022
 * @example getLocaleWeekYear("2022-01-01", "de-DE") // 2021 — Jan 1, 2022 is a Saturday, in week 52 of 2021
 * @example getLocaleWeekYear("2022-01-01", "en-US", { minimalDays: 0 }) // null
 * @example getLocaleWeekYear("+275760-09-13", "en-US") // 275760 (the last PlainDate; the next week 1 lies past the range)
 * @example getLocaleWeekYear("invalid", "en-US") // null
 */
export function getLocaleWeekYear(
  value: string,
  locale: string,
  options?: { minimalDays?: number },
): number | null {
  if (!isValidDate(value)) return null;

  const firstDay = getLocaleFirstDayOfWeek(locale);
  const minimalDays = resolveMinimalDaysInFirstWeek(options);
  if (firstDay === null || minimalDays === null) return null;

  try {
    const date = Temporal.PlainDate.from(value);
    return getLocaleWeekYearBounds(date, firstDay, minimalDays).weekYear;
  } catch {
    return null;
  }
}
