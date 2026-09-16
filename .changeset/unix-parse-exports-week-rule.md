---
"@northguild/gmt": minor
---

Export `parseMillisecondFromUnix` and `parseMinuteFromUnix` and three types their functions' signatures already named, and add a `minimalDays` option to `getLocaleWeekYear` and `getWeeksInLocaleWeekYear` (Story CORE-8).

**Two functions that shipped unreachable.** Both were implemented, documented and tested, but `unix/parse` never re-exported them, and the package's `exports` map blocks deep imports, so no path could reach them. Their `utc/` and `zoned/` equivalents were always exported.

```typescript
import { parseMillisecondFromUnix, parseMinuteFromUnix } from "@northguild/gmt/unix";

parseMillisecondFromUnix(1700000000123); // "123"
parseMinuteFromUnix(1700000000000); // "13"
```

**Three types a signature named but nobody could import.** `startOfTime`, `endOfTime` and `isValidDateRange` declared their unit and argument types without exporting them. `StartOfTimeUnit`, `EndOfTimeUnit` and `IsValidDateRangeProps` are now exported from `@northguild/gmt/plain` and the package root.

```typescript
import type { EndOfTimeUnit } from "@northguild/gmt/plain";

const unit: EndOfTimeUnit = "minute";
```

**A locale's week-numbering rule, stated by the caller.** Week 1 is the week, starting on the locale's first day of week, that holds at least `minimalDays` days of January ([UTS #35, Week Data](https://unicode.org/reports/tr35/tr35-dates.html#Week_Data)). ECMA-402 no longer exposes that value: `Intl.Locale.prototype.getWeekInfo` returns only `firstDay` and `weekend` ([tc39/proposal-intl-locale-info#86](https://github.com/tc39/proposal-intl-locale-info/issues/86)). So it is now an option, an integer from 1 to 7.

```typescript
import { getLocaleWeekYear, getWeeksInLocaleWeekYear } from "@northguild/gmt";

getLocaleWeekYear("2022-01-01", "en-US", { minimalDays: 1 }); // 2022 — January 1 is always in week 1
getLocaleWeekYear("2022-01-01", "en-US"); // 2021 — the ISO 8601 default of 4
getWeeksInLocaleWeekYear("2022-06-15", "en-US", { minimalDays: 1 }); // 53
getLocaleWeekYear("2022-01-01", "en-US", { minimalDays: 0 }); // null
```

In CLDR 48's `weekData` the world default is `1`, as in `US`, `CA`, `MX`, `JP` and `CN`. `4` is set for a list of mostly European regions such as `GB`, `DE` and `FR`, where it matches GMT's default.
