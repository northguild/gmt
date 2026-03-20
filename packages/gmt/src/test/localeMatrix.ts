export const MustTestLocales = {
  enUS: "en-US",
  enGB: "en-GB",
  deDE: "de-DE",
  frFR: "fr-FR",
  esES: "es-ES",
  itIT: "it-IT",
  ptPT: "pt-PT",
  svSE: "sv-SE",
  isIS: "is-IS",
  zhCN: "zh-CN",
  zhTW: "zh-TW",
  jaJP: "ja-JP",
  koKR: "ko-KR",
  arSA: "ar-SA",
  heIL: "he-IL",
  ruRU: "ru-RU",
  trTR: "tr-TR",
} as const;

export type MustTestLocale =
  (typeof MustTestLocales)[keyof typeof MustTestLocales];

export const MustTestLocaleSet = new Set<MustTestLocale>(
  Object.values(MustTestLocales),
);

export const MustTestLocaleMetadata: Record<
  MustTestLocale,
  { languageRegion: string; reason: string }
> = {
  [MustTestLocales.enUS]: {
    languageRegion: "English (US)",
    reason: "Default, most widely used",
  },
  [MustTestLocales.enGB]: {
    languageRegion: "English (UK)",
    reason: "British English variations",
  },
  [MustTestLocales.deDE]: {
    languageRegion: "German (Germany)",
    reason: "Major European language",
  },
  [MustTestLocales.frFR]: {
    languageRegion: "French (France)",
    reason: "Major European language",
  },
  [MustTestLocales.esES]: {
    languageRegion: "Spanish (Spain)",
    reason: "Major European language",
  },
  [MustTestLocales.itIT]: {
    languageRegion: "Italian (Italy)",
    reason: "Major European language",
  },
  [MustTestLocales.ptPT]: {
    languageRegion: "Portuguese (Portugal)",
    reason: "Major European language",
  },
  [MustTestLocales.svSE]: {
    languageRegion: "Swedish (Sweden)",
    reason: "Default date format uses ISO 8601",
  },
  [MustTestLocales.isIS]: {
    languageRegion: "Icelandic (Iceland)",
    reason: "Unique language with special chars",
  },
  [MustTestLocales.zhCN]: {
    languageRegion: "Chinese (China)",
    reason: "Major Asian language",
  },
  [MustTestLocales.zhTW]: {
    languageRegion: "Chinese (Taiwan)",
    reason: "Traditional Chinese",
  },
  [MustTestLocales.jaJP]: {
    languageRegion: "Japanese (Japan)",
    reason: "Major Asian language",
  },
  [MustTestLocales.koKR]: {
    languageRegion: "Korean (Korea)",
    reason: "Major Asian language",
  },
  [MustTestLocales.arSA]: {
    languageRegion: "Arabic (Saudi Arabia)",
    reason: "Right-to-left script",
  },
  [MustTestLocales.heIL]: {
    languageRegion: "Hebrew (Israel)",
    reason: "Right-to-left script",
  },
  [MustTestLocales.ruRU]: {
    languageRegion: "Russian (Russia)",
    reason: "Cyrillic script",
  },
  [MustTestLocales.trTR]: {
    languageRegion: "Turkish (Turkey)",
    reason: "Unique script and language",
  },
};
