---
"@northguild/gmt": patch
---

Long spans and long logs are much faster, and the business-day functions are smaller. No option or signature changes, and every function returns what it returned before, with one exception: a holiday array with its own `Symbol.iterator` is now read by index in `rollDate` and `isBusinessDay`, as `businessDaysBetween` already read it.

**Speed** (Node 24, warm, before → after):

| Function | Input | Before | After |
| --- | --- | --- | --- |
| `dutyViolations` | 365-day log | 336 ms | about 14 ms |
| `dutyViolations` | split sleeper rule, 10 years | 10,460 ms | 194 ms |
| `businessDaysBetween` | 480 holidays, 1 to 30 years | 3.74 ms | 0.048 ms |
| `operatingTimeBetween` | 1 year | 62.6 ms | 0.40 ms |
| `operatingTimeBetween` | 10 years | 444 ms | 0.67 ms (4.3 ms the first time) |
| `addOperatingTime` | 400 hours | 12.2 ms | 0.79 ms |
| `chargeableDays` and `freeTimeExpiry` | 10 years, `Europe/London` | 162.6 ms | 0.70 ms (4.7 ms the first time) |
| `chargeableDays` and `freeTimeExpiry` | 10 years, working days | 218.4 ms | 0.79 ms |
| `chargeableDays` and `freeTimeExpiry` | 10 years, `America/Port_of_Spain` | 177.7 ms | 0.59 ms |
| `intervalCountZoned`, `intervalOverlappingDaysZoned`, `dwellTime` | 100 years, `Europe/London` | 42 to 48 ms | about 2 ms |
| `intervalSplitAtZoned` | 1,000 points | 65.5 ms | 56.5 ms |
| Offset-change search | 40-year span, `Asia/Kolkata` | 34.8 ms | 19.8 ms the first time, 0.06 ms after |
| `formatDate` | `de-DE` | 0.073 ms | 0.0068 ms |
| `getLocaleMonthNames` | one locale | 1.28 ms | 0.036 ms |
| `cutoffSchedule` | 50 entries | 13.1 ms | 5.6 ms |

The cost of the day-count and operating-hours functions no longer grows with the number of days. A 10-year span now costs a small multiple of a 1-year span.

**Size** (minified / gzipped kB, one function imported):

| Import | Before | After |
| --- | --- | --- |
| `businessDaysBetween` | 172.5 / 50.1 | 155.9 / 45.6 |
| `addBusinessDays` | 173.6 / 50.6 | 157.0 / 46.0 |
| `formatDate` | 155.4 / 45.2 | 156.8 / 45.7 |
| `chargeableDays` | 197.3 / 57.8 | 196.4 / 58.5 |
| `operatingTimeBetween` | 200.8 / 58.8 | 204.0 / 60.6 |
| `dutyViolations` | 226.7 / 67.1 | 228.5 / 68.2 |
| the whole package (root) | 487.1 / 127.9 | 500.9 / 133.6 |

`@js-temporal/polyfill` alone is 152.5 / 44.2 kB, so it is most of every figure. The business-day functions are smaller because checking a time zone no longer loads the Temporal workarounds. `operatingTimeBetween`, `dutyViolations` and the root are a little larger, and `chargeableDays` a little larger gzipped: they hold the new methods and keep the day-by-day one for spans near the limits of Temporal's range. `formatDate` is 1.4 kB larger for its formatter cache.
