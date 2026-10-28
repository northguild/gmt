---
"@northguild/gmt": minor
---

Add month-day values (`--12-25`, a month and a day with no year) and year-month values (`2026-10`, a year and a month with no day): 23 functions and two regexes (Story CORE-102). A birthday, an anniversary or a fixed holiday has no year, and a card expiry or a billing month has no day. Until now the only way to store them was to invent the missing part, which turns 29 February into 1 March and puts a made-up `-01` on every month.

All 23 functions are in `plain/` and in the root. They return `""`, `false` or `null` for bad input and never throw.

```typescript
import {
  parseMonthDay,
  parseMonthDayWithPattern,
  monthDayToDate,
  formatMonthDay,
} from "@northguild/gmt";
import { isValidYearMonth, addYearMonth, endOfYearMonth } from "@northguild/gmt";

parseMonthDay("12-25"); // "--12-25"
parseMonthDayWithPattern("25 décembre", "d MMMM", "fr"); // "--12-25"
formatMonthDay("--12-25", "en-US", { month: "long", day: "numeric" }); // "December 25"
monthDayToDate("--02-29", 2023); // "2023-02-28" (a common year clamps, as Temporal does)
monthDayToDate("--02-29", 2024); // "2024-02-29"

isValidYearMonth("2026-10"); // true
addYearMonth("2026-12", { months: 1 }); // "2027-01"
endOfYearMonth("2024-02"); // "2024-02-29"
```

- **Month-day:** `isValidMonthDay`, `parseMonthDay`, `parseMonthDayFromDate`, `parseMonthDayFromDateTime`, `parseMonthDayWithPattern`, `formatMonthDay`, `compareMonthDays`, `areMonthDaysEqual`, `monthDayToDate`. `parseMonthDay` accepts `--MM-DD` and `MM-DD` and always writes `--MM-DD`. `--02-29` is valid; `--02-30` is not.
- **Year-month:** `isValidYearMonth`, `parseYearMonth`, `parseYearMonthFromDate`, `parseYearMonthFromDateTime`, `parseYearMonthWithPattern`, `formatYearMonth`, `compareYearMonths`, `areYearMonthsEqual`, `addYearMonth`, `subtractYearMonth`, `diffYearMonth`, `startOfYearMonth`, `endOfYearMonth`, `getDaysInYearMonth`. They accept `YYYY-MM` and `±YYYYYY-MM`. `addYearMonth` and `subtractYearMonth` take `years` and `months` only.
- **Regexes:** `plainMonthDay` and `plainYearMonth` in `@northguild/gmt/regex`.
- `isValidDate("2026-10")` and `parseDateWithPattern("10/2026", "MM/yyyy")` still return `false` and `""`. Use the year-month functions for those strings.
- `formatMonthDay` and `formatYearMonth` drop a field the value does not have, as `formatDate` does with a time field, and return `""` for a `timeStyle` or a calendar other than `gregory` or `iso8601`.
- `[u-ca=ISO8601]` in upper case now parses in both new readers on the polyfill, as it does on native Temporal.

Fixed: `parseDateWithPattern` and `parseDateTimeWithPattern` now read a month name written in a sentence, so `parseDateWithPattern("15 марта 2024", "d MMMM yyyy", "ru")` returns `"2024-03-15"` instead of `""`. A pattern may use `L`–`LLLL` for the stand-alone name, and `M`–`MMMM` match either form when the name is unambiguous.
