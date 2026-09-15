import { localeWeekInfo } from "./localeWeekInfo";

/**
 * Resolve the ISO day-of-week number (1 = Monday .. 7 = Sunday) that a
 * locale considers the first day of the week, from its CLDR week data
 * (`Intl.Locale#getWeekInfo`, or the older `weekInfo` accessor — see
 * `localeWeekInfo`).
 *
 * - Returns `null` if `locale` is not a valid BCP 47 tag.
 * - Falls back to `1` (Monday, matching GMT's existing ISO default in
 *   `startOfDate`/`startOfZoned`) if the runtime exposes no week data or
 *   none for the given locale.
 */
export function getLocaleFirstDayOfWeek(locale: string): number | null {
  try {
    const weekInfo = localeWeekInfo(locale);
    if (!weekInfo || typeof weekInfo.firstDay !== "number") {
      return 1;
    }
    return weekInfo.firstDay;
  } catch {
    return null;
  }
}
