---
"@burglekitt/gmt": minor
---

Add calendar quantity getters: `getDaysInMonth`, `getDaysInYear`, `getDayOfYear`, `getWeeksInYear`, `getWeeksInMonth`, `getWeekOfMonth` (Story J3).

All six take a `PlainDate` ISO string and return `number | null`. `getDaysInMonth`, `getDaysInYear`, and `getDayOfYear` wrap Temporal's own `daysInMonth`/`daysInYear`/`dayOfYear`. `getWeeksInYear` reports the ISO week-numbering year's total week count (52 or 53), resolved from `value`'s own `yearOfWeek` rather than its calendar year, since late-December/early-January dates can belong to a different ISO week-year than their calendar year.

`getWeeksInMonth` and `getWeekOfMonth` are locale-aware — they size and index a month's calendar-grid rows using `locale`'s first day of week, matching date-fns's `getWeekOfMonth` convention (the row containing the 1st of the month counts as row 1, even when partial). They live in `plain/calculate/`, not `plain/get/`, per the rule J0b established: `get/` namespaces are current-moment accessors only, and these take a date value.
