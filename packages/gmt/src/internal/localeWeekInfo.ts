// TypeScript's lib.es2024.intl.d.ts (as of TS 5.9) declares neither form of the Intl Locale
// Info proposal's week data. Augment the ambient type once, here, rather than widening every
// call site with `as unknown as`.
interface LocaleWeekInfo {
  firstDay: number;
  weekend: number[];
  minimalDays: number;
}

declare global {
  namespace Intl {
    interface Locale {
      /** The proposal's current API. V8 12.x and later (Node 24, Node 26). */
      getWeekInfo?(): Partial<LocaleWeekInfo>;
      /** The proposal's earlier accessor. Removed in V8 14 (Node 26); present on Node 22/24. */
      readonly weekInfo?: Partial<LocaleWeekInfo>;
    }
  }
}

/**
 * A locale's CLDR week data, from whichever form of the Intl Locale Info proposal the runtime
 * implements.
 *
 * - Prefers `Intl.Locale.prototype.getWeekInfo()`, the proposal's current method, and falls back
 *   to the earlier `weekInfo` accessor on engines that only have that (Node 22). Node 26 removed
 *   the accessor, so reading it alone silently returned `undefined` there and every locale lost
 *   its week data.
 * - Returns `undefined` when neither form is available. Fields may be missing: Node 24/26 omit
 *   `minimalDays`. Callers apply their own ISO defaults.
 * - Throws `RangeError` (from `Intl.Locale`) if `locale` is not a valid BCP 47 tag; callers turn
 *   that into their sentinel.
 *
 * @example localeWeekInfo("en-US")?.firstDay // 7
 * @example localeWeekInfo("ar-SA")?.weekend // [5, 6]
 */
export function localeWeekInfo(
  locale: string,
): Partial<LocaleWeekInfo> | undefined {
  const intlLocale = new Intl.Locale(locale);
  if (typeof intlLocale.getWeekInfo === "function") {
    return intlLocale.getWeekInfo();
  }
  return intlLocale.weekInfo;
}
