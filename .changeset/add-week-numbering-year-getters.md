---
"@burglekitt/gmt": minor
---

Add week-numbering year getters: `getWeekYear`, `getLocaleWeekYear`, `getWeeksInLocaleWeekYear` (Story J4).

`getWeekYear` reports the ISO 8601 week-numbering year a date belongs to (via `Temporal.PlainDate.yearOfWeek`), which can differ from the calendar year — 2024-12-30 is a Monday in ISO week 1 of **2025**, not 2024. Pair it with the existing `weekOfYearForDate`/`getWeekNumber` whenever bucketing by week number, since a week number alone is ambiguous across a year boundary.

`getLocaleWeekYear` and `getWeeksInLocaleWeekYear` are the locale-relative equivalents, resolved from `locale`'s first day of week and minimal-days-in-first-week (`Intl.Locale.prototype.weekInfo`) instead of the fixed ISO rule (Monday-start, 4 minimal days). The two can disagree on the same date near a year boundary — e.g. en-US always counts Jan 1 as week 1, while ISO-style locales do not.

All three take a `PlainDate` ISO string and return `number | null`. They live in `plain/calculate/`, not `plain/get/`, per the rule J0b established.
