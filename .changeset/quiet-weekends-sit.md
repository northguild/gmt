---
"@burglekitt/gmt": minor
---

Adds `isWeekend` (plain) and `isZonedWeekend` (zoned) — locale-aware weekend checks, matching react-aria's `@internationalized/date` `isWeekend(date, locale)`.

- `isWeekend(value, locale)` checks an ISO `PlainDate` string; `isZonedWeekend(value, locale)` checks an ISO `ZonedDateTime` string against its own local calendar day.
- Uses `Intl.Locale.prototype.weekInfo` to resolve which days count as the weekend for a given locale — e.g. `en-US`/most locales use Saturday/Sunday, while `he-IL`/`ar-SA` use Friday/Saturday.
- Falls back to Saturday/Sunday if the runtime can't resolve `weekInfo` data for the locale.
- Both return `false` for invalid input (unparseable date/zoned value, or an invalid locale tag).

This starts Story Group D (locale-aware calendar helpers) of the Luxon/react-aria parity roadmap.
