---
"@northguild/gmt": patch
---

Chinese and Dangi (Korean) calendar dates now format to GMT's empty value on every runtime.

Runtimes disagree on these calendars. Node and Chrome put the Chinese New Year 2027 on 7 February, while Safari and native `Temporal` put it on 6 February. GMT has no calendar data of its own, so it cannot pick one. A time or a weekday on its own still formats in these calendars.

The other answers that differed between runtimes are now the same everywhere:

- **Coptic.** The first day of the year 1 AM prints the era `AM` for the whole day. Safari printed `Anno Martyrum` for the first hours.
- **Zone names.** `CST6CDT`, `EST5EDT`, `MST7MDT`, `PST8PDT`, `CET`, `EET`, `MET`, `WET` and `Factory` are not valid zones on any runtime, in any letter case. Some runtimes accepted them and others did not.
- **Islamic dates before the Hijra** format to the empty value on Safari too.
- **Same zone.** Two zone names are the same zone only when they are the same name in any letter case, or both are one of `UTC`, `Etc/UTC`, `Etc/GMT` and `GMT`. A link and its target, such as `Asia/Calcutta` and `Asia/Kolkata`, are now two zones on Node and Chrome as well. `areZonedEqual` returns `false` for them, and a day-based difference between them returns the empty value.
- **Week data.** Runtimes carry different copies of the regional week data. Where they disagree, the functions that read the first day of the week or the weekend return their empty value. The first day is affected for the United Arab Emirates, China, Algeria, Iceland and Jordan, and the weekend for Bangladesh and Algeria. A locale with no region, such as `zh`, is affected when runtimes guess different regions for it. Naming the first day in the locale, such as `zh-CN-u-fw-mon`, gives the same answer on every runtime. A retired region code with a successor, such as `BU` for Myanmar, now reads the successor's data everywhere; the other retired codes return the empty value. The affected functions include `getLocaleStartOfWeek`, `getLocaleWeekYear`, `getWeekOfMonth` and `isWeekend`.
- **Weekday names.** `getLocaleWeekdayNames` lists the names from the locale's first day, so it returns an empty array for a locale whose first day is disputed, such as `zh-CN`.
- **Default calendar.** Runtimes give some locales different default calendars: Safari gives `ar-SA` the Umm al-Qura calendar and `en-TH` the Buddhist one, where the others give Gregorian. When the caller names no calendar for such a locale, a date formats to the empty value. A calendar named in the locale (`ar-SA-u-ca-gregory`) or in the `calendar` option is used on every runtime that has it.
