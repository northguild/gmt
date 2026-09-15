import { localeWeekInfo } from "./localeWeekInfo";

/**
 * Resolve the minimum number of days a week must have in January for that
 * week to count as a locale's week 1, from its CLDR week data
 * (`Intl.Locale#getWeekInfo`, or the older `weekInfo` accessor — see
 * `localeWeekInfo`).
 *
 * - Returns `null` if `locale` is not a valid BCP 47 tag.
 * - Falls back to `4` (matching ISO 8601's rule — week 1 is the first
 *   week with at least 4 days in January, equivalently the week
 *   containing Jan 4) if the runtime exposes no `minimalDays` for the
 *   locale. This mirrors `getLocaleFirstDayOfWeek`'s fallback-to-ISO-default
 *   pattern.
 * - Observed: Node 22's `weekInfo` accessor populates `minimalDays`, but
 *   `getWeekInfo()` on Node 24 and Node 26 (ICU 78) omits it for every
 *   locale, so this fallback engages universally there. `getLocaleWeekYear`
 *   and `getWeeksInLocaleWeekYear` therefore degrade to the ISO value on
 *   those runtimes, which is worth knowing before treating a
 *   Node-version-only test failure as a real bug.
 */
export function getLocaleMinimalDaysInFirstWeek(locale: string): number | null {
  try {
    const weekInfo = localeWeekInfo(locale);
    if (!weekInfo || typeof weekInfo.minimalDays !== "number") {
      return 4;
    }
    return weekInfo.minimalDays;
  } catch {
    return null;
  }
}
