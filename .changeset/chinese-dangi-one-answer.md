---
"@northguild/gmt": minor
---

The same call now gives the same value on every runtime: Node, Chrome, Firefox and Safari, with or without native `Temporal`. Where runtimes disagree and a standard gives one answer that every runtime can reach, GMT now gives that answer. Where no such answer exists, GMT returns its empty value on every runtime, even on runtimes that used to give a value.

- **Chinese and Dangi (Korean) calendars.** Runtimes put the Chinese New Year 2027 on different days: 7 February on Node and Chrome, 6 February on Safari and native `Temporal`. GMT has no calendar data of its own, so it cannot pick one. A date in these calendars formats to the empty value. A time or a weekday on its own still formats.
- **Coptic.** The first day of the year 1 AM prints the era `AM` for the whole day. Safari printed `Anno Martyrum` for the first hours.
- **Islamic dates before the Hijra** format to the empty value on Safari too.
- **Zone names.** `CST6CDT`, `EST5EDT`, `MST7MDT`, `PST8PDT`, `CET`, `EET`, `MET`, `WET` and `Factory` are not valid zones, in any letter case. Some runtimes accepted them and others did not.
- **Same zone.** Two zone names are the same zone only when they are the same name in any letter case, or when both are among `UTC`, `Etc/UTC`, `Etc/GMT` and `GMT`. A link and its target, such as `Asia/Calcutta` and `Asia/Kolkata`, are two zones.
- **Week data.** Runtimes carry different copies of the regional week data. Where they disagree, the functions that read the first day of the week or the weekend return their empty value. This affects the first day for the United Arab Emirates, China, Algeria, Iceland and Jordan, and the weekend for Bangladesh and Algeria. A locale with no region reads the data of its likely region, so `zh` is affected as China is. A language that runtimes place in different regions, such as `pi`, is affected too. Naming the first day in the locale, such as `zh-CN-u-fw-mon`, gives the same answer on every runtime. A retired region code with a successor (`BU`, `DD`, `FX`, `TP`, `YD`, `ZR`) reads the successor's data on every runtime. Other retired codes, such as `SU` and `YU`, return the empty value.
- **Default calendar.** Runtimes give some locales different default calendars: Safari gives `ar-SA` the Umm al-Qura calendar and `en-TH` the Buddhist one, where the others give Gregorian. When the caller names no calendar for such a locale, a date formats to the empty value. A calendar named in the locale (`ar-SA-u-ca-gregory`) or in the `calendar` option is used on every runtime that has it.

### Breaking changes

These calls return a different value from before on at least one runtime. To keep a value, name the calendar or the first day, or use a canonical zone name.

- **Formatting in Chinese, Dangi or a disputed default calendar** returns the empty value. This affects `formatDate`, `formatDateTime`, `formatDateRange`, `formatDateTimeRange`, `formatDateToParts`, `formatDateTimeToParts`, `formatCalendar`, `formatUtc`, `formatCalendarUtc`, `formatUnix`, `formatCalendarUnix`, `formatZonedDateTime`, `formatCalendarZoned`, `formatZonedRange` and `formatZonedToParts`.

  ```typescript
  formatDate("2027-02-06", "zh-u-ca-chinese"); // was a Chinese date, now ""
  formatDate("2024-03-15", "ar-SA"); // was a Gregorian date on Node and Chrome, now ""
  formatDate("2024-03-15", "ar-SA-u-ca-gregory"); // the Gregorian date on every runtime
  ```

- **The nine zone names** are refused by every function that reads a zone, and `getTimeZones` no longer lists them.

  ```typescript
  isValidTimeZone("CET"); // was true on Node and Chrome, now false
  isValidTimeZone("Europe/Paris"); // true
  ```

- **A link and its target are two zones** in `areZonedEqual`, `areZonedEqualBy`, `diffZoned`, `intervalLengthZoned`, `mapZonedDatesInRange` and `formatZonedRange`. A difference in days, weeks, months or years between them returns `null`. A difference in hours or smaller units still works.

  ```typescript
  areZonedEqual(
    "2024-01-01T05:30:00+05:30[Asia/Calcutta]",
    "2024-01-01T05:30:00+05:30[Asia/Kolkata]",
  ); // was true on Node and Chrome, now false
  diffZoned(
    "2024-01-01T05:30:00+05:30[Asia/Calcutta]",
    "2024-01-03T05:30:00+05:30[Asia/Kolkata]",
    "days",
  ); // was 2, now null; "hours" still gives 48
  ```

- **Disputed week data** returns the empty value from `getLocaleStartOfWeek`, `getLocaleEndOfWeek`, `getLocaleDayOfWeek`, `getLocaleWeekYear`, `getWeeksInLocaleWeekYear`, `getWeeksInMonth`, `getWeekOfMonth`, `isWeekend`, `isThisUnit`, `getLocaleZonedStartOfWeek`, `getLocaleZonedEndOfWeek`, `getLocaleZonedDayOfWeek`, `isZonedWeekend` and `isZonedThisUnit`. `getLocaleWeekdayNames` lists the names from the locale's first day, so it returns `[]` for these locales.

  ```typescript
  getLocaleStartOfWeek("2024-02-29", "zh-CN"); // was "2024-02-26" on Node, now ""
  getLocaleStartOfWeek("2024-02-29", "zh-CN-u-fw-mon"); // "2024-02-26" on every runtime
  getLocaleWeekdayNames("zh-CN"); // was seven names, now []
  ```
