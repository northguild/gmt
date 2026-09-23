---
"@northguild/gmt": minor
---

Make a `diff*` units array return the whole difference, number Sunday-first weeks by UTS #35, and read microseconds and nanoseconds in every `parseUnitFrom*` function (Story CORE-8).

**A units array accounts for the whole difference.** `diffDate`, `diffDateTime`, `diffTime`, `diffUtc`, `diffZoned` and `diffUnix` used the largest listed unit as Temporal's `largestUnit` and returned only the listed fields. The amount in any unit not listed was dropped: `["years", "days"]` across 1 year and 2 months returned `{ years: 1, days: 0 }`. Weeks were dropped too, because Temporal fills weeks only when they are the largest unit. Unlisted amounts now fold into the next smaller listed unit, measured from the start moved by the larger listed amounts, so the record adds back up to the difference. A contiguous list keeps Temporal's own fields and rounding.

```typescript
import { diffDate, diffDateTime } from "@northguild/gmt/plain";
import { diffZoned } from "@northguild/gmt/zoned";

diffDate("2024-01-01", "2025-03-15", ["years", "days"]); // { years: 1, days: 73 }
diffDate("2024-01-01", "2024-03-20", ["months", "weeks", "days"]); // { months: 2, weeks: 2, days: 5 }
diffDateTime("2024-01-01T00:00", "2024-03-20T05:00", ["months", "weeks", "hours"]); // { months: 2, weeks: 2, hours: 125 }
diffZoned("2024-02-10T00:00:00-05:00[America/New_York]", "2024-03-11T23:00:00-04:00[America/New_York]", ["months", "hours"]); // { months: 1, hours: 46 }
```

**An empty units array is invalid.** All six functions return `null` for `[]`, since no unit was asked for.

**`diffUnix` reads singular unit names in an array.** It returned `null` for `["month", "week"]`. It now returns plural keys like the other five, and its return type is `Record<DateTimeDurationUnit, number>`.

```typescript
import { diffUnix } from "@northguild/gmt/unix";

diffUnix(1704067200000, 1710892800000, ["month", "week"]); // { months: 2, weeks: 2 }
```

**Sunday-first week numbers follow UTS #35.** `getWeekNumber(value, "sunday")` counted weeks within the calendar year, so the last days of December could be week 53 or 54. UTS #35 Part 4, with a minimum of one day in the first week, puts them in week 1 of the next year when that week holds 1 January. The same rule applies to `parseWeekFromDate`, `parseWeekFromDateTime`, `parseWeekFromUtc`, `parseWeekFromZoned`, `parseWeekFromUnix` and `parseUnitFrom*(…, "week")` with `weekStartsOn: "sunday"`. Week numbers are 1–53 in both modes. Monday-first weeks were already ISO 8601 and are unchanged.

```typescript
import { getWeekNumber, parseWeekFromDate } from "@northguild/gmt/plain";

getWeekNumber("2024-12-31", "sunday"); // 1
getWeekNumber("2000-12-31", "sunday"); // 1
getWeekNumber("2024-12-28", "sunday"); // 52
parseWeekFromDate("2024-12-31", { weekStartsOn: "sunday" }); // 1
```

**`parseUnitFromDateTime`, `parseUnitFromTime`, `parseUnitFromUtc` and `parseUnitFromZoned` read `"microsecond"` and `"nanosecond"`.** `parseUnitFromUnix` already did. Each field is three digits, as Temporal's `microsecond` and `nanosecond` fields are.

```typescript
import { parseUnitFromTime } from "@northguild/gmt/plain";
import { parseUnitFromUtc } from "@northguild/gmt/utc";

parseUnitFromUtc("2023-11-14T22:13:20.123456789Z", "microseconds"); // "456"
parseUnitFromTime("22:13:20.123456789", "nanosecond"); // "789"
```

### Breaking changes

| Call | 1.15 | 1.16 |
| --- | --- | --- |
| `diffDate("2024-01-01", "2025-03-01", ["years", "days"])` | `{ years: 1, days: 0 }` | `{ years: 1, days: 59 }` |
| `diffDate("2024-01-01", "2024-03-20", ["months", "weeks"])` | `{ months: 2, weeks: 0 }` | `{ months: 2, weeks: 2 }` |
| `diffDate(a, b, [])`, likewise `diffDateTime`, `diffTime`, `diffUtc`, `diffZoned`, `diffUnix` | `{}` | `null` |
| `getWeekNumber("2024-12-31", "sunday")` | `53` | `1` |
| `getWeekNumber("2000-12-31", "sunday")` | `54` | `1` |

Migration: to get only the listed fields of Temporal's own difference, list every unit between the largest and the smallest you need, and ignore the ones you do not. For a calendar-year count of Sunday weeks, count from the year's first Sunday yourself.
