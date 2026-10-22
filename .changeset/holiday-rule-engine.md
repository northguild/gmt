---
"@northguild/gmt": minor
---

Add a holiday rule engine in the new `@northguild/gmt/calendar/rules` subpath (Story CORE-54). The root and `@northguild/gmt/calendar` export it too. Most holidays are rules, not lists, so you describe a holiday once and get its date for any year. GMT ships no holiday list: you supply the rules.

Six functions and three types:

- `nthWeekdayOfMonth(year, month, weekday, n)` finds the third Monday or the last Sunday of a month. `n` is `1` to `5`, `-1` to `-5` or `"last"`.
- `easterSunday(year, options?)` gives Easter Sunday. The `computus` option is `"gregorian"` (default) or `"julian"`, and a Julian date comes back as an ISO date.
- `observedDate(isoDate, policy, calendar?)` moves a date that falls on a day off. `ObservancePolicy` is keyed by ISO weekday, and each shift is `"nextWorkingDay"`, `{ next: weekday }` or `{ previous: weekday }`. There is no default policy.
- `holidayDates(rule, year, options?)` returns the dates of one `HolidayRule`. A rule is `fixed`, `calendarFixed` (such as 1 Shawwal in an Islamic calendar), `nthWeekday`, `easterRelative` or `dates`.
- `buildBusinessCalendar(spec)` expands rules over a year range into the `BusinessCalendar` that `isBusinessDay` and `addBusinessDays` already take.
- `isValidHolidayRule(rule)` is a type guard. It tells a rule that is wrong from a year in which the rule has no date.

```typescript
import { buildBusinessCalendar, easterSunday, nthWeekdayOfMonth, observedDate } from "@northguild/gmt/calendar/rules";

nthWeekdayOfMonth(2026, 3, 7, "last"); // "2026-03-29"
easterSunday(2024, { computus: "julian" }); // "2024-05-05"
observedDate("2027-12-25", { 6: { previous: 5 }, 7: { next: 1 } }); // "2027-12-24"

buildBusinessCalendar({
  timeZone: "UTC",
  weekend: [6, 7],
  rules: [
    { name: "Christmas", kind: "fixed", month: 12, day: 25, observed: { 6: "nextWorkingDay", 7: "nextWorkingDay" } },
    { name: "Second day", kind: "fixed", month: 12, day: 26, observed: { 6: "nextWorkingDay", 7: "nextWorkingDay" } },
  ],
  years: { from: 2021, to: 2021 },
}); // { weekend: [6, 7], holidays: ["2021-12-27", "2021-12-28"], timeZone: "UTC" }
```

Rules expand in list order, and each `"nextWorkingDay"` shift sees the calendar built so far. A moved holiday closes only the date it moved to; list the rule twice, once without `observed`, to close both. A date a year lacks, such as 29 February, is skipped and never clamped. Bad input gives `""` (the date functions), `[]` (`holidayDates`) or `null` (`buildBusinessCalendar`).

The docs add the Holiday Rule Builder, Observance Comparator and Moving Feasts tools, and a section in the business calendars guide.
