---
"@northguild/gmt": minor
---

Chinese and Dangi (Korean) dates, Coptic and Islamic edge dates now follow the standard on every runtime that can reach it.

- **Chinese and Dangi (Korean) calendars.** Some runtimes print a date in these calendars differently from the Purple Mountain Observatory (Chinese) or KASI (Dangi) date. Node and Chrome, for example, put the Chinese New Year 2027 on 7 February, where the observatory has 6 February. GMT has no calendar data of its own. On a runtime that prints these dates differently, a Chinese or Dangi date format returns `""` (`[]` for parts). A runtime that prints the same date as the standard keeps its own text. A weekday on its own still formats, and so does a time on its own for a value that has a time.
- **Coptic.** The first day of the year 1 AM prints the era `AM` for the whole day. Safari printed `Anno Martyrum` for the first hours, and for the start of the second day in a zone more than 16 hours ahead of UTC.
- **Islamic, 2 Muharram 1 AH.** In a zone more than 16 hours ahead of UTC, the start of the second day of the Hijra prints year 1 `AH`. Safari printed year 0 `Before Hijra`.

### Breaking changes

- **Formatting in the Chinese or Dangi calendar** returns the empty value on a runtime that prints the date differently from the standard. This affects `formatDate`, `formatDateTime`, `formatDateRange`, `formatDateTimeRange`, `formatDateToParts`, `formatDateTimeToParts`, `formatCalendar`, `formatUtc`, `formatCalendarUtc`, `formatUnix`, `formatCalendarUnix`, `formatZonedDateTime`, `formatCalendarZoned`, `formatZonedRange` and `formatZonedToParts`.

  ```typescript
  formatDate("2027-02-06", "zh-u-ca-chinese");
  // was "2026年腊月30" (ICU4C 78.3 on Node 26.12.1; the observatory has 2027 正月初一), now ""
  ```
