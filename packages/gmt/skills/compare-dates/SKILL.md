---
name: compare-dates
description: >
  Compare date values for ordering. Use isAfterDate, isBeforeDate, areDatesEqual
  for comparisons. Use areDatesEqualBy/areDateTimesEqualBy/areZonedEqualBy/
  areUnixEqualBy/areUtcEqualBy to compare two values at a given calendar unit
  ("are these in the same month?"). Use isWeekend/isZonedWeekend for
  locale-aware weekend checks (weekend days vary by locale — not always
  Saturday/Sunday). Use isBusinessDay for fixed ISO Monday–Friday business-day
  checks (locale-agnostic, matches addBusinessDays). Use
  getLocaleDayOfWeek/getLocaleZonedDayOfWeek to get a locale-relative
  day-of-week index (0 = first day of week). Returns false/null on invalid
  input.
sources:
  - 'burglekitt/gmt:packages/gmt/src/plain/compare/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/compare/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/compare/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/utc/compare/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/plain/calculate/getLocaleDayOfWeek.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/getLocaleZonedDayOfWeek.ts'
metadata:
  type: core
  library: '@burglekitt/gmt'
  library_version: '1.12.0'
---

# Compare Dates

Use this skill when you need to compare date values for ordering.

## Setup

```ts
import { isAfterDate, isBeforeDate, areDatesEqual } from "@burglekitt/gmt";
import { isBetweenDate } from "@burglekitt/gmt";
```

## Core Patterns

### Check if date is after another

```ts
const result = isAfterDate("2024-03-20", "2024-03-15"); // true
```

### Check if date is before another

```ts
const result = isBeforeDate("2024-03-10", "2024-03-15"); // true
```

### Check if dates are equal

```ts
import { areDatesEqual } from "@burglekitt/gmt";

const result = areDatesEqual("2024-03-15", "2024-03-15"); // true
```

### Check if two values are equal at a given unit (same month, same year, ...)

```ts
import { areDatesEqualBy } from "@burglekitt/gmt";

areDatesEqualBy("2024-03-15", "2024-03-20", "month"); // true
areDatesEqualBy("2023-03-15", "2024-03-15", "month"); // false — same month, different year
areDatesEqualBy("2024-03-11", "2024-03-17", "week"); // true (default weekStartsOn: "monday")
```

`areDatesEqualBy`/`areDateTimesEqualBy`/`areZonedEqualBy`/`areUnixEqualBy`/`areUtcEqualBy` are the namespace variants of this pattern (Decision 5 — one parameterized function per namespace instead of a `isSameDay`/`isSameMonth`/`isSameYear`/... family). Equality is measured by comparing the *start of that unit* for each value, so a coarser unit like `"month"` implicitly requires every unit above it (year) to match too — see the Common Mistakes entry below. `areZonedEqualBy` compares each value's own local calendar fields (its own time zone), not the underlying instant.

Migrating from date-fns:

| date-fns                     | GMT                                  |
| ----------------------------- | ------------------------------------- |
| `isSameDay(a, b)`             | `areDatesEqualBy(a, b, "day")`        |
| `isSameWeek(a, b, opts)`      | `areDatesEqualBy(a, b, "week", opts)` |
| `isSameMonth(a, b)`           | `areDatesEqualBy(a, b, "month")`      |
| `isSameYear(a, b)`            | `areDatesEqualBy(a, b, "year")`       |
| `isSameHour(a, b)`            | `areDateTimesEqualBy(a, b, "hour")`   |
| `isSameMinute(a, b)`          | `areDateTimesEqualBy(a, b, "minute")` |
| `isSameSecond(a, b)`          | `areDateTimesEqualBy(a, b, "second")` |

### Check if date is between two dates

```ts
import { isBetweenDate } from "@burglekitt/gmt";

const result = isBetweenDate("2024-03-15", "2024-03-10", "2024-03-20"); // true
```

### Compare datetime values

```ts
import { isAfterDateTime, isBeforeDateTime, areDateTimesEqual } from "@burglekitt/gmt";

const after = isAfterDateTime("2024-03-15T14:30:45", "2024-03-15T14:30:00"); // true
const before = isBeforeDateTime("2024-03-15T14:30:00", "2024-03-15T14:30:45"); // true
const equal = areDateTimesEqual("2024-03-15T14:30:45", "2024-03-15T14:30:45"); // true
```

### Compare time values

```ts
import { isAfterTime, isBeforeTime, areTimesEqual } from "@burglekitt/gmt";

const after = isAfterTime("14:30:45", "14:30:00"); // true
const before = isBeforeTime("14:30:00", "14:30:45"); // true
const equal = areTimesEqual("14:30:45", "14:30:45"); // true
```

### Check if a date falls on a weekend (locale-aware)

```ts
import { isWeekend, isZonedWeekend } from "@burglekitt/gmt";

isWeekend("2024-02-03", "en-US"); // true (Saturday, en-US weekend is Sat/Sun)
isWeekend("2024-02-02", "he-IL"); // true (Friday, he-IL weekend is Fri/Sat)

isZonedWeekend("2024-02-04T10:00:00+02:00[Asia/Jerusalem]", "he-IL"); // false (Sunday isn't part of he-IL's weekend)
```

`isZonedWeekend` checks the `ZonedDateTime`'s own local calendar day — no separate timezone conversion needed.

### Check if a date is a business day (fixed Mon–Fri)

```ts
import { isBusinessDay } from "@burglekitt/gmt";

isBusinessDay("2024-02-05"); // true (Monday)
isBusinessDay("2024-02-10"); // false (Saturday)
isBusinessDay("2024-02-04"); // false (Sunday)
```

`isBusinessDay` uses the fixed ISO Monday–Friday boundary (Mon=1 … Fri=5) — locale-agnostic and with no holiday calendar. It matches the boundary that `addBusinessDays`/`subtractBusinessDays` use, and is the locale-agnostic complement to `isWeekend` (which resolves weekend days per locale via `Intl.Locale`'s `weekInfo`).

### Get the locale-relative day-of-week index

```ts
import { getLocaleDayOfWeek, getLocaleZonedDayOfWeek } from "@burglekitt/gmt";

getLocaleDayOfWeek("2024-02-25", "en-US");       // 0 (Sunday = first day of en-US week)
getLocaleDayOfWeek("2024-02-26", "en-US");       // 1 (Monday)
getLocaleDayOfWeek("2024-02-26", "fr-FR");       // 0 (Monday = first day of fr-FR week)
getLocaleDayOfWeek("2024-02-24", "he-IL");       // 0 (Saturday = first day of he-IL week)

getLocaleZonedDayOfWeek("2024-02-25T12:00:00+00:00[UTC]", "en-US"); // 0
getLocaleZonedDayOfWeek("2024-02-26T12:00:00+00:00[UTC]", "fr-FR"); // 0
```

`getLocaleDayOfWeek` returns `null` on invalid input. `getLocaleZonedDayOfWeek` reads the `ZonedDateTime`'s local calendar day — no separate timezone conversion needed.

## Common Mistakes

### HIGH Using string comparison for dates

Wrong:

```ts
const isAfter = "2024-03-20" > "2024-03-15"; // true but fragile
```

Correct:

```ts
import { isAfterDate } from "@burglekitt/gmt";

const isAfter = isAfterDate("2024-03-20", "2024-03-15"); // true
```

Source: AGENTS.md — Use Temporal for proper comparison

### MEDIUM Not handling invalid input

Wrong:

```ts
const result = isAfterDate("invalid", "2024-03-15");
// Assume result is always boolean
if (result) { // false, not throwing
  process();
}
```

Correct:

```ts
import { isAfterDate, isValidDate } from "@burglekitt/gmt";

const dateA = "invalid";
const dateB = "2024-03-15";
if (!isValidDate(dateA) || !isValidDate(dateB)) {
  throw new Error("Invalid date");
}
const result = isAfterDate(dateA, dateB);
```

Source: packages/gmt/src/plain/compare/isAfterDate.ts — Returns false on invalid

### MEDIUM Comparing different date formats

Wrong:

```ts
const result = isAfterDate("2024-3-5", "2024-03-15"); // may be incorrect
```

Correct:

```ts
// Ensure canonical format before comparison
import { isAfterDate } from "@burglekitt/gmt";

const result = isAfterDate("2024-03-05", "2024-03-15");
```

Source: Temporal.PlainDate.from() — canonicalizes input

### MEDIUM Assuming weekends are always Saturday/Sunday

Wrong:

```ts
import { getDayOfWeek } from "@burglekitt/gmt";

const day = getDayOfWeek(); // ISO day of week, always Monday-start
const isWeekendDay = day === 6 || day === 7; // wrong for he-IL/ar-SA (Fri/Sat)
```

Correct:

```ts
import { isWeekend } from "@burglekitt/gmt";

const isWeekendDay = isWeekend("2024-02-02", "he-IL"); // true — Friday is part of he-IL's weekend
```

Most locales use Saturday/Sunday, but `he-IL`/`ar-SA` use Friday/Saturday — `isWeekend`/`isZonedWeekend` resolve this per-locale via `Intl.Locale`'s `weekInfo` instead of hardcoding a day pair.

Source: packages/gmt/src/plain/compare/isWeekend.ts — locale-aware via Intl.Locale weekInfo

### MEDIUM Confusing isBusinessDay with isWeekend

Wrong:

```ts
const isWeekendDay = isBusinessDay("2024-02-02"); // false (it's a Friday)
// then assume isBusinessDay captures locale-specific weekend days
```

Correct:

```ts
import { isWeekend } from "@burglekitt/gmt";

// isBusinessDay is fixed ISO Mon–Fri (no locale lookup, no holidays)
isBusinessDay("2024-02-02"); // true (Friday)

// For locale-aware weekend detection (e.g. he-IL Fri/Sat), use isWeekend
isWeekend("2024-02-02", "he-IL"); // true (Friday is part of he-IL's weekend)
```

`isBusinessDay` uses a fixed Monday–Friday boundary and never consults `Intl.Locale`'s `weekInfo`; it does not account for holidays. Do not reach for it when you need locale-aware weekend detection — that's `isWeekend`/`isZonedWeekend`'s job.

Source: packages/gmt/src/plain/compare/isBusinessDay.ts — fixed ISO Mon–Fri, locale-agnostic

### MEDIUM Assuming "same month" ignores the year

Wrong:

```ts
import { areDatesEqualBy } from "@burglekitt/gmt";

// Assuming this checks "is it March, regardless of year"
const bothMarch = areDatesEqualBy("2023-03-15", "2024-03-15", "month"); // false, not true
```

Correct:

```ts
import { areDatesEqualBy } from "@burglekitt/gmt";

// "Same month" means the same month AND year — matches date-fns's isSameMonth
// and Luxon's dt.hasSame(other, "month")
areDatesEqualBy("2024-03-01", "2024-03-31", "month"); // true (same month, same year)

// To check "same month-of-year regardless of year", compare the month field directly
import { parseMonthFromDate } from "@burglekitt/gmt";
const sameMonthOfYear =
  parseMonthFromDate("2023-03-15") === parseMonthFromDate("2024-03-15"); // true
```

`areDatesEqualBy(a, b, unit)` compares the start-of-`unit` boundary for each value, so any unit implicitly requires every coarser unit above it to match too — this is deliberate (Decision 5/6, `context/roadmap/issues/J.md`) and matches date-fns/Luxon precedent, not a GMT-specific quirk.

Source: packages/gmt/src/plain/compare/areDatesEqualBy.ts — start-of-unit comparison

## References

- [Full compare API](references/compare-api.md)
- [Temporal.PlainDate comparison](https://tc39.es/proposal-temporal/docs/plaindate.html#comparison)