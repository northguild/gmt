---
name: compare-dates
description: >
  Compare date values for ordering. Use isAfterDate, isBeforeDate, areDatesEqual
  for comparisons. Use areDatesEqualBy/areDateTimesEqualBy/areZonedEqualBy/
  areUnixEqualBy/areUtcEqualBy to compare two values at a given calendar unit
  ("same month?"). Use isWeekend/isZonedWeekend for locale-aware weekend checks
  (weekend days vary by locale). Use isBusinessDay for fixed ISO Mon-Fri checks
  (locale-agnostic, matches addBusinessDays). Use
  getLocaleDayOfWeek/getLocaleZonedDayOfWeek for a locale-relative day-of-week
  index (0 = first day of week). Use isRelativeDay/isThisUnit/isPast/isFuture
  (plus isZoned* variants) for now-relative predicates ("is this today", "is
  this overdue") — depend on system clock/timeZone unless using the zoned
  variants with an explicit timeZone. Use nextWeekday/previousWeekday for the
  next/previous occurrence of an ISO day of week ("next Friday"). Returns
  false/null/"" on invalid input.
sources:
  - 'northguild/gmt:packages/gmt/src/plain/compare/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/compare/index.ts'
  - 'northguild/gmt:packages/gmt/src/unix/compare/index.ts'
  - 'northguild/gmt:packages/gmt/src/utc/compare/index.ts'
  - 'northguild/gmt:packages/gmt/src/plain/calculate/getLocaleDayOfWeek.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/calculate/getLocaleZonedDayOfWeek.ts'
  - 'northguild/gmt:packages/gmt/src/plain/calculate/nextWeekday.ts'
  - 'northguild/gmt:packages/gmt/src/plain/calculate/previousWeekday.ts'
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.14.1'
---

# Compare Dates

Use this skill when you need to compare date values for ordering.

## Setup

```ts
import { isAfterDate, isBeforeDate, areDatesEqual } from "@northguild/gmt";
import { isBetweenDate } from "@northguild/gmt";
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
import { areDatesEqual } from "@northguild/gmt";

const result = areDatesEqual("2024-03-15", "2024-03-15"); // true
```

### Check if two values are equal at a given unit (same month, same year, ...)

```ts
import { areDatesEqualBy } from "@northguild/gmt";

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
import { isBetweenDate } from "@northguild/gmt";

const result = isBetweenDate("2024-03-15", "2024-03-10", "2024-03-20"); // true
```

### Compare datetime values

```ts
import { isAfterDateTime, isBeforeDateTime, areDateTimesEqual } from "@northguild/gmt";

const after = isAfterDateTime("2024-03-15T14:30:45", "2024-03-15T14:30:00"); // true
const before = isBeforeDateTime("2024-03-15T14:30:00", "2024-03-15T14:30:45"); // true
const equal = areDateTimesEqual("2024-03-15T14:30:45", "2024-03-15T14:30:45"); // true
```

### Compare time values

```ts
import { isAfterTime, isBeforeTime, areTimesEqual } from "@northguild/gmt";

const after = isAfterTime("14:30:45", "14:30:00"); // true
const before = isBeforeTime("14:30:00", "14:30:45"); // true
const equal = areTimesEqual("14:30:45", "14:30:45"); // true
```

### Check if a date falls on a weekend (locale-aware)

```ts
import { isWeekend, isZonedWeekend } from "@northguild/gmt";

isWeekend("2024-02-03", "en-US"); // true (Saturday, en-US weekend is Sat/Sun)
isWeekend("2024-02-02", "he-IL"); // true (Friday, he-IL weekend is Fri/Sat)

isZonedWeekend("2024-02-04T10:00:00+02:00[Asia/Jerusalem]", "he-IL"); // false (Sunday isn't part of he-IL's weekend)
```

`isZonedWeekend` checks the `ZonedDateTime`'s own local calendar day — no separate timezone conversion needed.

### Check if a date is a business day (fixed Mon–Fri)

```ts
import { isBusinessDay } from "@northguild/gmt";

isBusinessDay("2024-02-05"); // true (Monday)
isBusinessDay("2024-02-10"); // false (Saturday)
isBusinessDay("2024-02-04"); // false (Sunday)
```

`isBusinessDay` uses the fixed ISO Monday–Friday boundary (Mon=1 … Fri=5) — locale-agnostic and with no holiday calendar. It matches the boundary that `addBusinessDays`/`subtractBusinessDays` use, and is the locale-agnostic complement to `isWeekend` (which resolves weekend days per locale via `Intl.Locale`'s `weekInfo`).

### Get the locale-relative day-of-week index

```ts
import { getLocaleDayOfWeek, getLocaleZonedDayOfWeek } from "@northguild/gmt";

getLocaleDayOfWeek("2024-02-25", "en-US");       // 0 (Sunday = first day of en-US week)
getLocaleDayOfWeek("2024-02-26", "en-US");       // 1 (Monday)
getLocaleDayOfWeek("2024-02-26", "fr-FR");       // 0 (Monday = first day of fr-FR week)
getLocaleDayOfWeek("2024-02-24", "he-IL");       // 0 (Saturday = first day of he-IL week)

getLocaleZonedDayOfWeek("2024-02-25T12:00:00+00:00[UTC]", "en-US"); // 0
getLocaleZonedDayOfWeek("2024-02-26T12:00:00+00:00[UTC]", "fr-FR"); // 0
```

`getLocaleDayOfWeek` returns `null` on invalid input. `getLocaleZonedDayOfWeek` reads the `ZonedDateTime`'s local calendar day — no separate timezone conversion needed.

### Check now-relative predicates (today, this month, past, future)

```ts
import { isRelativeDay, isThisUnit, isPast, isFuture } from "@northguild/gmt";

isRelativeDay("2024-03-15", 0);   // "is today" — true if today is 2024-03-15
isRelativeDay("2024-03-14", -1);  // "is yesterday" — true if today is 2024-03-15
isRelativeDay("2024-03-16", 1);   // "is tomorrow" — true if today is 2024-03-15

isThisUnit("2024-03-15", "month");            // true if today is any day in March 2024
isThisUnit("2024-02-26", "week", "fr-FR");    // locale-aware week boundary (fr-FR starts Monday)

isPast("2024-03-14");   // true if today is 2024-03-15 (strictly before, not on-or-before)
isFuture("2024-03-16"); // true if today is 2024-03-15 (strictly after, not on-or-before)
```

`isRelativeDay` subsumes `isToday`/`isYesterday`/`isTomorrow` (`offsetDays: 0`/`-1`/`1`); `isThisUnit` subsumes `isThisWeek`/`isThisMonth`/`isThisYear` (Decision 5, `context/roadmap/issues/J.md`). All four compare against `getToday()`, so they depend on the **system clock and system timeZone** — see the Common Mistakes entry below before using these in a server or test context.

Zoned counterparts — `isZonedRelativeDay`, `isZonedThisUnit`, `isZonedPast`, `isZonedFuture` — take a `ZonedDateTime` string and resolve "today"/"now" in *that value's own* timeZone, making them deterministic regardless of the host's system timeZone:

```ts
import { isZonedRelativeDay, isZonedThisUnit, isZonedPast, isZonedFuture } from "@northguild/gmt";

isZonedRelativeDay("2024-03-15T10:00:00-04:00[America/New_York]", 0); // "today" in America/New_York, not the host's timeZone
isZonedThisUnit("2024-03-15T10:00:00-04:00[America/New_York]", "month");

// isZonedPast/isZonedFuture compare the exact instant (not just the calendar
// day) against Temporal.Now.instant() — the zoned counterpart carries a
// full time-of-day, unlike the plain, day-only isPast/isFuture.
isZonedPast("2020-01-01T00:00:00Z[UTC]");   // true
isZonedFuture("2999-01-01T00:00:00Z[UTC]"); // true
```

### Find the next/previous occurrence of a weekday

```ts
import { nextWeekday, previousWeekday } from "@northguild/gmt";

nextWeekday("2024-03-13", 5); // "2024-03-15" (Wednesday -> next Friday)
nextWeekday("2024-03-15", 5); // "2024-03-22" (already Friday -> advances a full week by default)
nextWeekday("2024-03-15", 5, { inclusive: true }); // "2024-03-15" (already Friday -> returned as-is)

previousWeekday("2024-03-13", 5); // "2024-03-08" (Wednesday -> previous Friday)
previousWeekday("2024-03-15", 5); // "2024-03-08" (already Friday -> goes back a full week by default)
```

`dayOfWeek` uses Temporal's ISO numbering (1 = Monday … 7 = Sunday), the same as `getDayOfWeek`/`parseDayOfWeekFromDate`. These replace date-fns's sixteen `next*`/`previous*` functions with two parameterized calls (Decision 5, `context/roadmap/issues/J.md`):

| date-fns          | GMT                          |
| ------------------ | ------------------------------ |
| `nextMonday(v)`    | `nextWeekday(v, 1)`           |
| `nextFriday(v)`    | `nextWeekday(v, 5)`           |
| `nextDay(v, n)`    | `nextWeekday(v, n)`           |
| `previousFriday(v)`| `previousWeekday(v, 5)`       |
| `previousDay(v, n)`| `previousWeekday(v, n)`       |

`date-fns`'s `lastDayOfMonth` is already covered by `endOfDate(value, "month")` — not a gap this pair fills.

## Common Mistakes

### HIGH Using string comparison for dates

Wrong:

```ts
const isAfter = "2024-03-20" > "2024-03-15"; // true but fragile
```

Correct:

```ts
import { isAfterDate } from "@northguild/gmt";

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
import { isAfterDate, isValidDate } from "@northguild/gmt";

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
import { isAfterDate } from "@northguild/gmt";

const result = isAfterDate("2024-03-05", "2024-03-15");
```

Source: Temporal.PlainDate.from() — canonicalizes input

### MEDIUM Assuming weekends are always Saturday/Sunday

Wrong:

```ts
import { getDayOfWeek } from "@northguild/gmt";

const day = getDayOfWeek(); // ISO day of week, always Monday-start
const isWeekendDay = day === 6 || day === 7; // wrong for he-IL/ar-SA (Fri/Sat)
```

Correct:

```ts
import { isWeekend } from "@northguild/gmt";

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
import { isWeekend } from "@northguild/gmt";

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
import { areDatesEqualBy } from "@northguild/gmt";

// Assuming this checks "is it March, regardless of year"
const bothMarch = areDatesEqualBy("2023-03-15", "2024-03-15", "month"); // false, not true
```

Correct:

```ts
import { areDatesEqualBy } from "@northguild/gmt";

// "Same month" means the same month AND year — matches date-fns's isSameMonth
// and Luxon's dt.hasSame(other, "month")
areDatesEqualBy("2024-03-01", "2024-03-31", "month"); // true (same month, same year)

// To check "same month-of-year regardless of year", compare the month field directly
import { parseMonthFromDate } from "@northguild/gmt";
const sameMonthOfYear =
  parseMonthFromDate("2023-03-15") === parseMonthFromDate("2024-03-15"); // true
```

`areDatesEqualBy(a, b, unit)` compares the start-of-`unit` boundary for each value, so any unit implicitly requires every coarser unit above it to match too — this is deliberate (Decision 5/6, `context/roadmap/issues/J.md`) and matches date-fns/Luxon precedent, not a GMT-specific quirk.

Source: packages/gmt/src/plain/compare/areDatesEqualBy.ts — start-of-unit comparison

### HIGH Assuming isRelativeDay/isThisUnit/isPast/isFuture are timeZone-independent

Wrong:

```ts
import { isRelativeDay } from "@northguild/gmt";

// Assuming "today" means the same thing everywhere
const isDueToday = isRelativeDay(dueDate, 0);
```

Correct:

```ts
import { isZonedRelativeDay } from "@northguild/gmt";

// "Today" is resolved in the value's own timeZone — deterministic
// regardless of the host machine's system timeZone
const isDueToday = isZonedRelativeDay(dueZonedDateTime, 0);
```

`isRelativeDay`/`isThisUnit`/`isPast`/`isFuture` depend on the **system clock and system timeZone** (they compare against `getToday()`). The same call returns different answers on hosts in different timeZones at the same instant — `isRelativeDay("2024-03-15", 0)` can be true in one timeZone and false in another 24 hours apart (e.g. `Pacific/Apia` vs. `Pacific/Niue`). Callers needing determinism — server-side rendering, tests, scheduled jobs — should use the zoned variants (`isZonedRelativeDay`, `isZonedThisUnit`, `isZonedPast`, `isZonedFuture`) with an explicit timeZone, or compare against an explicit reference with `areDatesEqualBy`/`isBeforeDate`/`isAfterDate`.

Source: packages/gmt/src/plain/compare/isRelativeDay.ts, packages/gmt/src/plain/get/getToday.ts — system clock/timeZone dependency

### MEDIUM Assuming nextWeekday/previousWeekday return the input when it's already on the target day

Wrong:

```ts
import { nextWeekday } from "@northguild/gmt";

// Assuming a Friday input returns itself when asking for "next Friday"
const result = nextWeekday("2024-03-15", 5); // "2024-03-22", not "2024-03-15"
```

Correct:

```ts
import { nextWeekday } from "@northguild/gmt";

// Pass { inclusive: true } to return the input as-is when it already falls on dayOfWeek
const result = nextWeekday("2024-03-15", 5, { inclusive: true }); // "2024-03-15"
```

`options.inclusive` defaults to `false`, matching date-fns: a `value` already on `dayOfWeek` advances a full week rather than returning itself. Same default applies to `previousWeekday`.

Source: packages/gmt/src/plain/calculate/nextWeekday.ts, packages/gmt/src/plain/calculate/previousWeekday.ts — inclusive defaults to false

## References

- [Full compare API](references/compare-api.md)
- [Temporal.PlainDate comparison](https://tc39.es/proposal-temporal/docs/plaindate.html#comparison)