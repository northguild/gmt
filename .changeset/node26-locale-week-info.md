---
"@northguild/gmt": patch
---

Fix locale week data on Node 26.

Node 26 (V8 14) removed the `Intl.Locale#weekInfo` accessor in favour of the Intl Locale Info proposal's `getWeekInfo()` method. GMT read only the accessor, so on Node 26 every locale silently fell back to ISO defaults: weeks started on Monday, weekends were Saturday and Sunday, and week-year rules used ISO's minimal days.

The functions affected on Node 26 were `getLocaleStartOfWeek`, `getLocaleEndOfWeek`, `getLocaleDayOfWeek`, `getLocaleWeekYear`, `getWeeksInLocaleWeekYear`, `getWeekOfMonth`, `getWeeksInMonth`, `getLocaleWeekdayNames`, `isWeekend`, `isThisUnit` and their zoned twins. For example, `en-US` weeks started on Monday instead of Sunday, and `ar-SA` weekends were Saturday and Sunday instead of Friday and Saturday.

GMT now calls `getWeekInfo()` when the runtime has it and falls back to `weekInfo` otherwise, so results are the same on Node 22, 24 and 26.
