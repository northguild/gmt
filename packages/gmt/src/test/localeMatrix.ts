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

export const LocaleToIanaTimezone = {
  [MustTestLocales.enUS]: "America/New_York",
  [MustTestLocales.enGB]: "Europe/London",
  [MustTestLocales.deDE]: "Europe/Berlin",
  [MustTestLocales.frFR]: "Europe/Paris",
  [MustTestLocales.esES]: "Europe/Madrid",
  [MustTestLocales.itIT]: "Europe/Rome",
  [MustTestLocales.ptPT]: "Europe/Lisbon",
  [MustTestLocales.svSE]: "Europe/Stockholm",
  [MustTestLocales.isIS]: "Atlantic/Reykjavik",
  [MustTestLocales.zhCN]: "Asia/Shanghai",
  [MustTestLocales.zhTW]: "Asia/Taipei",
  [MustTestLocales.jaJP]: "Asia/Tokyo",
  [MustTestLocales.koKR]: "Asia/Seoul",
  [MustTestLocales.arSA]: "Asia/Riyadh",
  [MustTestLocales.heIL]: "Asia/Jerusalem",
  [MustTestLocales.ruRU]: "Europe/Moscow",
  [MustTestLocales.trTR]: "Europe/Istanbul",
} as const;

type LocaleKey = keyof typeof LocaleToIanaTimezone;

export const localeZonedDateTimeInputByLocale: Record<LocaleKey, string> = {
  [MustTestLocales.enUS]: "2024-02-03T14:30:45-05:00[America/New_York]",
  [MustTestLocales.enGB]: "2024-02-03T14:30:45+00:00[Europe/London]",
  [MustTestLocales.deDE]: "2024-02-03T14:30:45+01:00[Europe/Berlin]",
  [MustTestLocales.frFR]: "2024-02-03T14:30:45+01:00[Europe/Paris]",
  [MustTestLocales.esES]: "2024-02-03T14:30:45+01:00[Europe/Madrid]",
  [MustTestLocales.itIT]: "2024-02-03T14:30:45+01:00[Europe/Rome]",
  [MustTestLocales.ptPT]: "2024-02-03T14:30:45+00:00[Europe/Lisbon]",
  [MustTestLocales.svSE]: "2024-02-03T14:30:45+01:00[Europe/Stockholm]",
  [MustTestLocales.isIS]: "2024-02-03T14:30:45+00:00[Atlantic/Reykjavik]",
  [MustTestLocales.zhCN]: "2024-02-03T14:30:45+08:00[Asia/Shanghai]",
  [MustTestLocales.zhTW]: "2024-02-03T14:30:45+08:00[Asia/Taipei]",
  [MustTestLocales.jaJP]: "2024-02-03T14:30:45+09:00[Asia/Tokyo]",
  [MustTestLocales.koKR]: "2024-02-03T14:30:45+09:00[Asia/Seoul]",
  [MustTestLocales.arSA]: "2024-02-03T14:30:45+03:00[Asia/Riyadh]",
  [MustTestLocales.heIL]: "2024-02-03T14:30:45+02:00[Asia/Jerusalem]",
  [MustTestLocales.ruRU]: "2024-02-03T14:30:45+03:00[Europe/Moscow]",
  [MustTestLocales.trTR]: "2024-02-03T14:30:45+03:00[Europe/Istanbul]",
};

export const localeZonedRangeInputByLocale: Record<
  LocaleKey,
  { start: string; end: string }
> = {
  [MustTestLocales.enUS]: {
    start: "2024-02-03T14:30:45-05:00[America/New_York]",
    end: "2024-02-03T16:46:15-05:00[America/New_York]",
  },
  [MustTestLocales.enGB]: {
    start: "2024-02-03T14:30:45+00:00[Europe/London]",
    end: "2024-02-03T16:46:15+00:00[Europe/London]",
  },
  [MustTestLocales.deDE]: {
    start: "2024-02-03T14:30:45+01:00[Europe/Berlin]",
    end: "2024-02-03T16:46:15+01:00[Europe/Berlin]",
  },
  [MustTestLocales.frFR]: {
    start: "2024-02-03T14:30:45+01:00[Europe/Paris]",
    end: "2024-02-03T16:46:15+01:00[Europe/Paris]",
  },
  [MustTestLocales.esES]: {
    start: "2024-02-03T14:30:45+01:00[Europe/Madrid]",
    end: "2024-02-03T16:46:15+01:00[Europe/Madrid]",
  },
  [MustTestLocales.itIT]: {
    start: "2024-02-03T14:30:45+01:00[Europe/Rome]",
    end: "2024-02-03T16:46:15+01:00[Europe/Rome]",
  },
  [MustTestLocales.ptPT]: {
    start: "2024-02-03T14:30:45+00:00[Europe/Lisbon]",
    end: "2024-02-03T16:46:15+00:00[Europe/Lisbon]",
  },
  [MustTestLocales.svSE]: {
    start: "2024-02-03T14:30:45+01:00[Europe/Stockholm]",
    end: "2024-02-03T16:46:15+01:00[Europe/Stockholm]",
  },
  [MustTestLocales.isIS]: {
    start: "2024-02-03T14:30:45+00:00[Atlantic/Reykjavik]",
    end: "2024-02-03T16:46:15+00:00[Atlantic/Reykjavik]",
  },
  [MustTestLocales.zhCN]: {
    start: "2024-02-03T14:30:45+08:00[Asia/Shanghai]",
    end: "2024-02-03T16:46:15+08:00[Asia/Shanghai]",
  },
  [MustTestLocales.zhTW]: {
    start: "2024-02-03T14:30:45+08:00[Asia/Taipei]",
    end: "2024-02-03T16:46:15+08:00[Asia/Taipei]",
  },
  [MustTestLocales.jaJP]: {
    start: "2024-02-03T14:30:45+09:00[Asia/Tokyo]",
    end: "2024-02-03T16:46:15+09:00[Asia/Tokyo]",
  },
  [MustTestLocales.koKR]: {
    start: "2024-02-03T14:30:45+09:00[Asia/Seoul]",
    end: "2024-02-03T16:46:15+09:00[Asia/Seoul]",
  },
  [MustTestLocales.arSA]: {
    start: "2024-02-03T14:30:45+03:00[Asia/Riyadh]",
    end: "2024-02-03T16:46:15+03:00[Asia/Riyadh]",
  },
  [MustTestLocales.heIL]: {
    start: "2024-02-03T14:30:45+02:00[Asia/Jerusalem]",
    end: "2024-02-03T16:46:15+02:00[Asia/Jerusalem]",
  },
  [MustTestLocales.ruRU]: {
    start: "2024-02-03T14:30:45+03:00[Europe/Moscow]",
    end: "2024-02-03T16:46:15+03:00[Europe/Moscow]",
  },
  [MustTestLocales.trTR]: {
    start: "2024-02-03T14:30:45+03:00[Europe/Istanbul]",
    end: "2024-02-03T16:46:15+03:00[Europe/Istanbul]",
  },
};
