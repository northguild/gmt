---
"@burglekitt/gmt": minor
---

Add calendar-system foundation: `CalendarSystem` type and `convertDateToCalendar` (Story E1), with Hebrew as the first supported non-Gregorian calendar.

`convertDateToCalendar(value, calendar)` expresses a PlainDate in a different calendar system, built entirely on Temporal's native calendar support (`PlainDate.prototype.withCalendar`) — no ported leap-year tables or arithmetic, since the polyfill already implements the full Metonic 19-year Hebrew leap-year cycle (7 leap years per cycle, a 13th month inserted before Adar) correctly.

The output string format deliberately diverges from Temporal's own `[u-ca=...]` annotation convention: Temporal's `toString()` always keeps the ISO/proleptic-Gregorian digits and only tags the calendar, hiding the calendar-native fields behind object accessors GMT's string-only contract has no equivalent for. GMT's annotated string instead carries the calendar's own year/month/day (e.g. `"5785-01-01[u-ca=hebrew]"` for Hebrew year 5785, not the ISO year), so the calendar-system concept is visible directly in the string. A plain, unannotated ISO string is always the `"gregorian"` calendar, so every existing GMT function keeps working unchanged, and `convertDateToCalendar(value, "gregorian")` always returns a bare ISO string.

New `CalendarSystem` type at `packages/gmt/src/types/calendar-system.ts` (seeded with `"gregorian" | "hebrew"`, extended by E2–E4 as they land), new `plain/convert/` module, and a new `isValidCalendarDate` validator accepting both plain and calendar-annotated PlainDate strings.
