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

const LocaleToIanaTimezone = {
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

// Plain-date counterpart for formatDateRange (J14). A PlainDate has no
// timezone, so unlike localeZonedRangeInputByLocale this is not derived
// per-locale — every locale formats the same two-calendar-day span.
const PLAIN_DATE_RANGE = { start: "2024-02-03", end: "2024-02-05" };
export const localeDateRangeInputByLocale: Record<
  LocaleKey,
  { start: string; end: string }
> = Object.fromEntries(
  Object.values(MustTestLocales).map((locale) => [locale, PLAIN_DATE_RANGE]),
) as Record<LocaleKey, { start: string; end: string }>;

// Plain-datetime counterpart of the zoned range fixtures above, for
// formatDateTimeRange (J14). Same calendar date/time values, no offset or
// IANA zone attached.
export const localeDateTimeRangeInputByLocale: Record<
  LocaleKey,
  { start: string; end: string }
> = Object.fromEntries(
  Object.entries(localeZonedRangeInputByLocale).map(([locale, range]) => [
    locale,
    { start: range.start.slice(0, 19), end: range.end.slice(0, 19) },
  ]),
) as Record<LocaleKey, { start: string; end: string }>;
