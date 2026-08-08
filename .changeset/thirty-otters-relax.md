---
"@burglekitt/gmt": minor
---

Adds `getLocaleStartOfWeek`/`getLocaleEndOfWeek` (plain) and `getLocaleZonedStartOfWeek`/`getLocaleZonedEndOfWeek` (zoned) — locale-aware week boundaries, matching react-aria's `@internationalized/date` `startOfWeek(date, locale)`/`endOfWeek(date, locale)`.

- Derives the week's first day from the locale via `Intl.Locale.prototype.weekInfo` (e.g. `en-US` weeks start Sunday, `fr-FR` weeks start Monday), instead of the existing `startOfDate`/`endOfDate`/`startOfZoned`/`endOfZoned`'s explicit, ISO-biased `weekStartsOn` option.
- Falls back to Monday if the runtime can't resolve `weekInfo` data for the locale.
- The zoned variants accept the same `disambiguation`/`offset` options as `startOfZoned`/`endOfZoned`, controlling DST gap/overlap resolution when the week-boundary time-of-day reset lands on an ambiguous local time.
- All four return `""` for invalid input (unparseable date/zoned value, or an invalid locale tag).

Part of Story Group D (locale-aware calendar helpers) of the Luxon/react-aria parity roadmap.
