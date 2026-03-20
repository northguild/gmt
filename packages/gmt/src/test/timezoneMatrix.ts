import { MustTestLocales } from "./localeMatrix";

export const MustTestDstTimezones = {
  "America/New_York": "America/New_York",
  "Asia/Shanghai": "Asia/Shanghai",
  "Asia/Kolkata": "Asia/Kolkata",
  "Asia/Kathmandu": "Asia/Kathmandu",
  "Pacific/Chatham": "Pacific/Chatham",
  "Pacific/Apia": "Pacific/Apia",
  "Pacific/Niue": "Pacific/Niue",
  UTC: "UTC",
  "Etc/GMT": "Etc/GMT",
  "Europe/Helsinki": "Europe/Helsinki",
} as const;

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

export const MustTestTimezones = {
  ...MustTestDstTimezones,
  ...MustTestLocaleTimezones,
};
