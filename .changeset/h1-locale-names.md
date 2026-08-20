---
"@burglekitt/gmt": minor
---

Add standalone, locale-aware calendar-name lookups (Story H1):

- `getLocaleMonthNames(locale, style?)` — 12 Gregorian month names in calendar order
- `getLocaleWeekdayNames(locale, style?)` — 7 weekday names in the locale's first-day order
- `getLocaleMeridiems(locale)` — `[AM-label, PM-label]` day-period labels

These are the GMT equivalents of Luxon's `Info.months` / `weekdays` / `meridiems`: they return locale-formatted calendar names without requiring a date value. All three delegate to the host runtime's `Intl` data and return `[]` for an invalid BCP 47 locale tag. `getLocaleWeekdayNames` uses locale-first-day ordering to stay consistent with `getLocaleDayOfWeek`.
