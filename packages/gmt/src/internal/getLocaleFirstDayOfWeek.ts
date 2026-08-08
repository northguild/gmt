// `Intl.Locale.prototype.weekInfo`'s ambient type augmentation lives in
// `getLocaleWeekendDays.ts` (TS's lib.d.ts doesn't declare it as of TS 5.9).
// Declared once there; this file relies on that global augmentation rather
// than redeclaring it.

/**
 * Resolve the ISO day-of-week number (1 = Monday .. 7 = Sunday) that a
 * locale considers the first day of the week, via
 * `Intl.Locale.prototype.weekInfo`.
 *
 * - Returns `null` if `locale` is not a valid BCP 47 tag.
 * - Falls back to `1` (Monday, matching GMT's existing ISO default in
 *   `startOfDate`/`startOfZoned`) if `weekInfo` is unavailable on the
 *   runtime (older engines) or unresolvable for the given locale.
 */
export function getLocaleFirstDayOfWeek(locale: string): number | null {
  try {
    const weekInfo = new Intl.Locale(locale).weekInfo;
    if (!weekInfo || typeof weekInfo.firstDay !== "number") {
      return 1;
    }
    return weekInfo.firstDay;
  } catch {
    return null;
  }
}
