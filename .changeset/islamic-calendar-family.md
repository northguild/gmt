---
"@burglekitt/gmt": minor
---

Add Islamic calendar family: `"islamic-civil"`, `"islamic-tabular"`, and `"islamic-umalqura"` calendar systems (Story E2), extending `CalendarSystem` and `convertDateToCalendar` from E1.

Like Hebrew, all three are built entirely on Temporal's native calendar support — no ported leap-year tables or arithmetic. This includes `"islamic-umalqura"`, the Saudi civil calendar: rather than porting `@internationalized/date`'s bundled Umm al-Qura lookup table into GMT, `convertDateToCalendar` resolves it through the polyfill's own built-in Umm al-Qura implementation, avoiding a second, divergence-prone copy of the same data. The three variants are not interchangeable — civil and tabular use different fixed leap-year cycles (Friday vs. Thursday epoch, one day apart), and Umm al-Qura's tabulated dates diverge from both by more than a fixed offset on some dates, so GMT does not approximate one variant with another's arithmetic.

Fixed a latent bug this story surfaced: `convertDateToCalendar`'s output annotation used to read a Temporal `PlainDate`'s own `calendarId` directly, which happened to match GMT's calendar identifiers for `"gregorian"`/`"hebrew"` but diverges for `"islamic-tabular"` (Temporal's id is `"islamic-tbla"`). The annotation now always maps back through GMT's own `CalendarSystem` identifiers, so `convertDateToCalendar(value, "islamic-tabular")` reliably returns `[u-ca=islamic-tabular]`, not `[u-ca=islamic-tbla]`.
