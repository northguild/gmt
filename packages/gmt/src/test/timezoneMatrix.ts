import { MustTestLocales } from "./localeMatrix";

/**
 * Canonical timezone IDs that stress offset and date-boundary behavior.
 *
 * Example lookups:
 * - MustTestDstTimezones["UTC"] => "UTC"
 * - MustTestDstTimezones["America/New_York"] => "America/New_York"
 * - MustTestDstTimezones["Europe/Helsinki"] => "Europe/Helsinki"
 * - MustTestDstTimezones["Pacific/Apia"] => "Pacific/Apia"
 * - MustTestDstTimezones["Pacific/Niue"] => "Pacific/Niue"
 */
export const MustTestDstTimezones = {
  UTC: "UTC",
  GMT: "GMT",
  "Etc/GMT": "Etc/GMT",
  "Europe/Lisbon": "Europe/Lisbon",
  "Europe/Dublin": "Europe/Dublin",
  "Europe/Berlin": "Europe/Berlin",
  "Europe/Helsinki": "Europe/Helsinki",
  "Europe/Istanbul": "Europe/Istanbul",
  "Asia/Kolkata": "Asia/Kolkata",
  "Asia/Kathmandu": "Asia/Kathmandu",
  "Asia/Shanghai": "Asia/Shanghai",
  "Australia/Lord_Howe": "Australia/Lord_Howe",
  "Pacific/Chatham": "Pacific/Chatham",
  "Pacific/Apia": "Pacific/Apia",
  "Pacific/Niue": "Pacific/Niue",
  "America/New_York": "America/New_York",
  "America/Chicago": "America/Chicago",
  "America/Phoenix": "America/Phoenix",
} as const;

/**
 * Locale to representative timezone mapping for locale-aware APIs.
 *
 * Examples from this map:
 * - MustTestLocaleTimezones[MustTestLocales.enUS] => "America/New_York"
 *
 * Related matrix examples used by timezone-centric tests:
 * - MustTestDstTimezones["UTC"] => "UTC"
 * - MustTestDstTimezones["Europe/Helsinki"] => "Europe/Helsinki"
 * - MustTestDstTimezones["Pacific/Apia"] => "Pacific/Apia"
 * - MustTestDstTimezones["Pacific/Niue"] => "Pacific/Niue"
 */
export const MustTestLocaleTimezones = {
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

export const LocaleTimezones = {
  "America/New_York": "America/New_York",
  "Europe/London": "Europe/London",
  "Europe/Berlin": "Europe/Berlin",
  "Europe/Paris": "Europe/Paris",
  "Europe/Madrid": "Europe/Madrid",
  "Europe/Rome": "Europe/Rome",
  "Europe/Lisbon": "Europe/Lisbon",
  "Europe/Stockholm": "Europe/Stockholm",
  "Atlantic/Reykjavik": "Atlantic/Reykjavik",
  "Asia/Shanghai": "Asia/Shanghai",
  "Asia/Taipei": "Asia/Taipei",
  "Asia/Tokyo": "Asia/Tokyo",
  "Asia/Seoul": "Asia/Seoul",
  "Asia/Riyadh": "Asia/Riyadh",
  "Asia/Jerusalem": "Asia/Jerusalem",
  "Europe/Moscow": "Europe/Moscow",
  "Europe/Istanbul": "Europe/Istanbul",
};

export const TestTimezones = {
  ...MustTestDstTimezones,
  ...LocaleTimezones,
};
