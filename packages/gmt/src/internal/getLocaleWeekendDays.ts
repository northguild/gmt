import { localeWeekInfo } from "./localeWeekInfo";

/**
 * Resolve the set of ISO day-of-week numbers (1 = Monday .. 7 = Sunday)
 * that count as "weekend" for a locale, from its CLDR week data
 * (`Intl.Locale#getWeekInfo`, or the older `weekInfo` accessor — see
 * `localeWeekInfo`).
 *
 * - Returns `null` if `locale` is not a well-formed BCP 47 tag; a well-formed tag with no
 *   locale data does not throw, so it does not return `null` either.
 * - Falls back to Saturday/Sunday (`[6, 7]`) if the runtime exposes no week
 *   data or none for the given locale.
 */
export function getLocaleWeekendDays(locale: string): Set<number> | null {
  try {
    const weekInfo = localeWeekInfo(locale);
    if (!weekInfo || !Array.isArray(weekInfo.weekend)) {
      return new Set([6, 7]);
    }
    return new Set(weekInfo.weekend);
  } catch {
    return null;
  }
}
