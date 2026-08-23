---
"@burglekitt/gmt": minor
---

Add era-based solar calendar family: `"japanese"`, `"buddhist"`, `"taiwan"`, `"persian"`, `"indian"` calendar systems (Story E3), extending `CalendarSystem` and `convertDateToCalendar` from E1/E2.

All five are built entirely on Temporal's native calendar support — no ported leap-year tables or arithmetic. Buddhist and Taiwan are fixed year-offset calendars over the same Gregorian day/month structure; Persian and Indian are distinct solar calendars with their own leap-year rules (Persian: a 33-year cycle; Indian: aligned to the Gregorian leap-year rule rather than an independent cycle), verified against `@internationalized/date`'s corresponding sources rather than assumed to be offset-only.

`"japanese"` gets a different annotated-string shape than every other calendar: Temporal's `.year` for it stays proleptic across imperial era changes (it does not reset to `1` the way the calendar's own numbering does), so `convertDateToCalendar` tags it with `.eraYear` and an era name instead (`"0006-10-03[u-ca=japanese;era=reiwa]"`, not a plain proleptic year). GMT also does not replicate `@internationalized/date`'s pre-Meiji (before 1868-10-23) restriction — since the conversion is built entirely on Temporal's own calendar support, and Temporal resolves those dates correctly under a synthetic `"japanese"` era, rejecting them would mean adding validation solely to reproduce another library's gap rather than an actual GMT limitation.
