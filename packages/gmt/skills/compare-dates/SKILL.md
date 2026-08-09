---
name: compare-dates
description: >
  Compare date values for ordering. Use isAfterDate, isBeforeDate, areDatesEqual
  for comparisons. Use isWeekend/isZonedWeekend for locale-aware weekend checks
  (weekend days vary by locale — not always Saturday/Sunday). Use
  getLocaleDayOfWeek/getLocaleZonedDayOfWeek to get a locale-relative
  day-of-week index (0 = first day of week). Returns false/null on invalid
  input.
sources:
  - 'burglekitt/gmt:packages/gmt/src/plain/compare/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/compare/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/plain/get/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/get/index.ts'
metadata:
  type: core
  library: '@burglekitt/gmt'
  library_version: '1.7.0'
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

## References

- [Full compare API](references/compare-api.md)
- [Temporal.PlainDate comparison](https://tc39.es/proposal-temporal/docs/plaindate.html#comparison)