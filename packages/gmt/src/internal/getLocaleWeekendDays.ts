// TypeScript's lib.es2024.intl.d.ts (as of TS 5.9) does not yet declare
// `Intl.Locale.prototype.weekInfo`, even though it has shipped at runtime
// since Node 18 / V8 99. Augment the ambient type locally rather than
// widening every call site with `as unknown as`.
interface LocaleWeekInfo {
  firstDay: number;
  weekend: number[];
  minimalDays: number;
}

declare global {
  namespace Intl {
    interface Locale {
      readonly weekInfo: LocaleWeekInfo;
    }
  }
}

/**
 * Resolve the set of ISO day-of-week numbers (1 = Monday .. 7 = Sunday)
 * that count as "weekend" for a locale, via `Intl.Locale.prototype.weekInfo`.
 *
 * - Returns `null` if `locale` is not a valid BCP 47 tag.
 * - Falls back to Saturday/Sunday (`[6, 7]`) if `weekInfo` is unavailable
 *   on the runtime (older engines) or unresolvable for the given locale.
 */
export function getLocaleWeekendDays(locale: string): Set<number> | null {
  try {
    const weekInfo = new Intl.Locale(locale).weekInfo;
    if (!weekInfo || !Array.isArray(weekInfo.weekend)) {
      return new Set([6, 7]);
    }
    return new Set(weekInfo.weekend);
  } catch {
    return null;
  }
}
