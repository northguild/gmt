/**
 * Resolve the minimum number of days a week must have in January for that
 * week to count as a locale's week 1, via `Intl.Locale.prototype.weekInfo`.
 *
 * - Returns `null` if `locale` is not a valid BCP 47 tag.
 * - Falls back to `4` (matching ISO 8601's rule — week 1 is the first
 *   week with at least 4 days in January, equivalently the week
 *   containing Jan 4) if `weekInfo` is unavailable on the runtime (older
 *   engines) or unresolvable for the given locale. This mirrors
 *   `getLocaleFirstDayOfWeek`'s fallback-to-ISO-default pattern.
 * - Observed on Node 24 (V8/ICU 78): `weekInfo` omits `minimalDays`
 *   entirely, for every locale, even though Node 20/22 (ICU 77) populate
 *   it — so this fallback engages universally on that runtime rather
 *   than only for locales missing data. `getLocaleWeekYear` and
 *   `getWeeksInLocaleWeekYear` therefore lose locale-specific
 *   minimal-days behavior (silently degrading to the ISO value) on
 *   runtimes where the engine doesn't expose it, which is worth knowing
 *   before treating a Node-version-only test failure as a real bug.
 */
export function getLocaleMinimalDaysInFirstWeek(locale: string): number | null {
  try {
    const weekInfo = new Intl.Locale(locale).weekInfo;
    if (!weekInfo || typeof weekInfo.minimalDays !== "number") {
      return 4;
    }
    return weekInfo.minimalDays;
  } catch {
    return null;
  }
}
