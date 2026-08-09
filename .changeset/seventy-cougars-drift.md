---
"@burglekitt/gmt": minor
---

Adds `getLocaleDayOfWeek` (plain) and `getLocaleZonedDayOfWeek` (zoned) — locale-aware day-of-week index extraction.

- `getLocaleDayOfWeek(value, locale)` returns a 0-based index where `0` = the locale's first day of week (e.g. Sunday for en-US, Monday for fr-FR, Saturday for he-IL).
- `getLocaleZonedDayOfWeek(value, locale)` does the same for zoned ISO datetimes, reading the local calendar day.
- Both derive the locale's first day from `Intl.Locale.prototype.weekInfo` and fall back to Monday if unavailable.
- Both return `null` for invalid input (unparseable date/zoned value, or an invalid locale tag).
- The formula `(isoDay - firstDay + 7) % 7` is the same one used by `getLocaleStartOfWeek`/`getLocaleZonedStartOfWeek`.

Completes Story Group D (locale-aware calendar helpers) of the Luxon/react-aria parity roadmap.
