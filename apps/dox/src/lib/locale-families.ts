/**
 * Presentation-only data for the why-gmt locale matrix chart: which script
 * family a locale belongs to, and its English display name.
 *
 * `gmtStats.localeList` (published by `scripts/stats.mjs` from
 * `packages/gmt/src/test/localeMatrix.ts`'s `MustTestLocales`) is the source
 * of truth for *which* locales exist. This map only decorates each one for
 * the chart — it must never add or drop a locale on its own, which is what
 * `locale-families.test.ts` polices.
 */

export interface LocaleFamilyInfo {
  family: string;
  name: string;
}

/** Locale (BCP-47) -> script family + English display name. */
export const LOCALE_FAMILIES: Record<string, LocaleFamilyInfo> = {
  "en-US": { family: "Latin", name: "English (US)" },
  "en-GB": { family: "Latin", name: "English (UK)" },
  "de-DE": { family: "Latin", name: "German" },
  "fr-FR": { family: "Latin", name: "French" },
  "es-ES": { family: "Latin", name: "Spanish" },
  "it-IT": { family: "Latin", name: "Italian" },
  "pt-PT": { family: "Latin", name: "Portuguese" },
  "sv-SE": { family: "Latin", name: "Swedish" },
  "is-IS": { family: "Latin", name: "Icelandic" },
  "zh-CN": { family: "CJK", name: "Chinese (Simplified)" },
  "zh-TW": { family: "CJK", name: "Chinese (Traditional)" },
  "ja-JP": { family: "CJK", name: "Japanese" },
  "ko-KR": { family: "CJK", name: "Korean" },
  "ar-SA": { family: "Arabic/Hebrew", name: "Arabic" },
  "he-IL": { family: "Arabic/Hebrew", name: "Hebrew" },
  "ru-RU": { family: "Cyrillic", name: "Russian" },
  "tr-TR": { family: "Turkic", name: "Turkish" },
};

/** One row per locale in `locales`, in order, with its row index within its family. */
export function localeMatrixRows(
  locales: readonly string[],
): { locale: string; family: string; name: string; row: number }[] {
  const rowByFamily = new Map<string, number>();
  return locales.map((locale) => {
    const info = LOCALE_FAMILIES[locale];
    if (!info) {
      throw new Error(
        `locale-families: ${locale} is in gmtStats.localeList but has no entry in LOCALE_FAMILIES`,
      );
    }
    const row = rowByFamily.get(info.family) ?? 0;
    rowByFamily.set(info.family, row + 1);
    return { locale, family: info.family, name: info.name, row };
  });
}

/** Family -> how many of `locales` belong to it, in order of first appearance. */
export function familyCounts(
  locales: readonly string[],
): { family: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const locale of locales) {
    const family = LOCALE_FAMILIES[locale]?.family;
    if (!family) {
      throw new Error(
        `locale-families: ${locale} is in gmtStats.localeList but has no entry in LOCALE_FAMILIES`,
      );
    }
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  return [...counts.entries()].map(([family, count]) => ({ family, count }));
}

/** "Latin (9), CJK (4), Arabic/Hebrew (2), Cyrillic (1), Turkic (1)" */
export function formatFamilyCounts(
  counts: readonly { family: string; count: number }[],
): string {
  return counts.map(({ family, count }) => `${family} (${count})`).join(", ");
}
