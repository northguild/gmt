---
name: calculate-dates
description: >
  Add or subtract time from dates. Use addDays, addMonths, subtractTime for date
  arithmetic. Use addBusinessDays/subtractBusinessDays for business-day
  arithmetic (skips weekends). Use diffDate for differences. Use clampDate to
  restrict a date to a range, or closestDateTo for the nearest candidate by
  calendar distance. add*/subtract* accept optional overflow ("constrain" |
  "reject"); diff* accept optional smallestUnit/roundingIncrement/roundingMode.
  Use getLocaleStartOfWeek/getLocaleEndOfWeek for locale-driven week boundaries
  instead of startOfDate/endOfDate's ISO-biased weekStartsOn. Use
  setDate/setDateTime/setTime to set fields atomically (safer than composing
  add* calls field-by-field). Use cycleDate/cycleDateTime/cycleTime to wrap a
  single field instead of carrying into the next (month +1 from December stays
  in the same year, unlike addMonths).
sources:
  - 'northguild/gmt:packages/gmt/src/plain/calculate/index.ts'
  - 'northguild/gmt:packages/gmt/src/plain/calculate/clampDate.ts'
  - 'northguild/gmt:packages/gmt/src/plain/calculate/closestDateTo.ts'
  - 'northguild/gmt:packages/gmt/src/plain/calculate/setDate.ts'
  - 'northguild/gmt:packages/gmt/src/plain/calculate/setDateTime.ts'
  - 'northguild/gmt:packages/gmt/src/plain/calculate/setTime.ts'
  - 'northguild/gmt:packages/gmt/src/plain/calculate/cycleDate.ts'
  - 'northguild/gmt:packages/gmt/src/plain/calculate/cycleDateTime.ts'
  - 'northguild/gmt:packages/gmt/src/plain/calculate/cycleTime.ts'
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.14.2'
---

# Calculate Dates

Use this skill when you need to perform date arithmetic (add, subtract, diff).

## Setup

```ts
import { addDays, addMonths, addYears } from "@northguild/gmt";
import { subtractTime, diffDate } from "@northguild/gmt";
import { startOfDate, endOfDate } from "@northguild/gmt";
```

## Core Patterns

### Add days to a date

```ts
const result = addDays("2024-03-15", 5); // "2024-03-20"
```

### Add months to a date

```ts
const result = addMonths("2024-03-15", 2); // "2024-05-15"
```

### Add years to a date

```ts
const result = addYears("2024-03-15", 1); // "2025-03-15"
```

### Subtract time from date

```ts
import { subtractTime } from "@northguild/gmt";

const result = subtractTime("2024-03-15T14:30:45", { hours: 2 }); // "2024-03-15T12:30:45"
```

### Add business days (skip weekends)

```ts
import { addBusinessDays, subtractBusinessDays } from "@northguild/gmt";

addBusinessDays("2024-03-15", 1); // "2024-03-18" — skips Sat/Sun
addBusinessDays("2024-03-16", 1); // "2024-03-18" — Saturday start still skips to Monday

subtractBusinessDays("2024-03-18", 1); // "2024-03-15"
subtractBusinessDays("2024-03-17", 1); // "2024-03-15" — Sunday start still skips to Friday
```

### Calculate difference between dates (in days)

```ts
import { diffDate } from "@northguild/gmt";

const diff = diffDate("2024-03-15", "2024-03-20", "day"); // 5
```

Need a full multi-unit breakdown (e.g. `"P26D"`) instead of a single-unit number? See the `durations` skill's `diffDateAsDuration`/`diffDateTimeAsDuration`/`diffZonedAsDuration`/`diffUnixAsDuration`/`diffUtcAsDuration` bridge functions.

### Get start of day

```ts
import { startOfDate } from "@northguild/gmt";

const start = startOfDate("2024-03-15T14:30:45"); // "2024-03-15T00:00:00"
```

### Get end of day

```ts
import { endOfDate } from "@northguild/gmt";

const end = endOfDate("2024-03-15T14:30:45"); // "2024-03-15T23:59:59.999999999"
```

### Get start of month

```ts
import { startOfDate } from "@northguild/gmt";

const start = startOfDate("2024-03-15", "month"); // "2024-03-01"
```

### Get end of month

```ts
import { endOfDate } from "@northguild/gmt";

const end = endOfDate("2024-03-15", "month"); // "2024-03-31"
```

### Get quarter boundaries

```ts
import { startOfQuarterForDate, endOfQuarterForDate } from "@northguild/gmt";

const q1Start = startOfQuarterForDate("2024-03-15"); // "2024-01-01"
const q1End = endOfQuarterForDate("2024-03-15"); // "2024-03-31"
```

### Clamp a date to a range

```ts
import { clampDate } from "@northguild/gmt";

clampDate("2024-03-15", "2024-03-01", "2024-03-31");
// "2024-03-15"

clampDate("2024-02-01", "2024-03-01", "2024-03-31");
// "2024-03-01" (below min)

clampDate("2024-05-01", "2024-03-01", "2024-03-31");
// "2024-03-31" (above max)

clampDate("2024-03-15", "2024-03-31", "2024-03-01");
// "" (min > max is invalid)
```

### Find the nearest date to a target

```ts
import { closestDateTo } from "@northguild/gmt";

closestDateTo("2024-03-15", ["2024-03-01", "2024-03-20", "2024-03-18"]);
// "2024-03-18"

closestDateTo("2024-03-15", ["2024-03-01", "2024-03-29"]);
// "2024-03-01" (tie-breaking favors first in array order when equidistant)

closestDateTo("2024-03-15", []);
// null (empty candidates)

closestDateTo("invalid", ["2024-03-01"]);
// null (invalid target)
```

Distance is measured in whole calendar days via `Temporal.PlainDate.until()`. On a tie between two equidistant candidates, the first one in array order wins.

### Get locale-aware week boundaries

```ts
import { getLocaleStartOfWeek, getLocaleEndOfWeek } from "@northguild/gmt";

getLocaleStartOfWeek("2024-02-29", "en-US"); // "2024-02-25" (Sunday, en-US weeks start Sunday)
getLocaleStartOfWeek("2024-02-29", "fr-FR"); // "2024-02-26" (Monday, fr-FR weeks start Monday)

getLocaleEndOfWeek("2024-02-29", "en-US"); // "2024-03-02" (Saturday)
getLocaleEndOfWeek("2024-02-29", "fr-FR"); // "2024-03-03" (Sunday)
```

Unlike `startOfDate(value, "week", { weekStartsOn })`/`endOfDate(value, "week", { weekStartsOn })`, which take an explicit ISO-biased `weekStartsOn` (`"monday"` | `"sunday"`, default `"monday"`), `getLocaleStartOfWeek`/`getLocaleEndOfWeek` derive the week's first day automatically from the locale via `Intl.Locale.prototype.weekInfo`, falling back to Monday if the runtime can't resolve `weekInfo` for the locale. Both return `""` for invalid `value` or an unresolvable `locale`. Zoned equivalents (`getLocaleZonedStartOfWeek`/`getLocaleZonedEndOfWeek`) live in the `zoned-date-ops` skill.

### Set one or more fields directly

```ts
import { setDate, setDateTime, setTime } from "@northguild/gmt";

setDate("2024-03-10", { year: 2025 }); // "2025-03-10"
setDate("2024-01-31", { month: 2 }); // "2024-02-29" (constrain clamps to the last valid day)
setDate("2024-01-31", { month: 2 }, { overflow: "reject" }); // "" (Feb 31 doesn't exist)
setDate("2024-03-10", {}); // "2024-03-10" (empty fields object is a no-op)

setDateTime("2024-03-10T12:00:00", { hour: 9 }); // "2024-03-10T09:00:00"
setTime("12:00:00", { hour: 25 }); // "23:00:00" (constrain clamps; overflow has a real effect here, unlike addTime's clock wraparound)
```

`setDate`/`setDateTime`/`setTime` wrap `Temporal.*.prototype.with()`, which resolves every supplied field in a single atomic overflow pass. This is the safe alternative to composing `addDate()`/`addDateTime()`/`addTime()` calls field-by-field: each sequential `.add()` resolves overflow against its own intermediate value, so setting month-then-day vs. day-then-month on the same target can silently diverge — `.with()` has no such order-dependence. Zoned/unix/utc equivalents (`setZoned`/`setUnix`/`setUtc`) live in the `zoned-date-ops` skill, since they also take `disambiguation`/`offset`.

### Control out-of-range add/subtract results with overflow

```ts
import { addDate } from "@northguild/gmt";

// default overflow: "constrain" clamps to the nearest valid date
const clamped = addDate("2024-01-31", { months: 1 }); // "2024-02-29"

// overflow: "reject" returns the sentinel instead of clamping
const rejected = addDate("2024-01-31", { months: 1 }, { overflow: "reject" }); // ""
```

`overflow` is available on `addDate`, `addDateTime`, `addTime`, `addUnix`, `addUtc`, `addZoned`, and their `subtract` equivalents. It defaults to `"constrain"` (matches prior behavior) and is accepted-but-inert on `addTime`/`subtractTime`, since `PlainTime` arithmetic always wraps around the clock rather than producing an out-of-range value.

### Add/subtract business days (Mon–Fri only)

```ts
import { addBusinessDays, subtractBusinessDays } from "@northguild/gmt";

addBusinessDays("2024-03-15", 1);
// "2024-03-18" (Friday + 1 business day skips Sat/Sun to Monday)

subtractBusinessDays("2024-03-18", 1);
// "2024-03-15" (Monday - 1 business day skips Sat/Sun to Friday)

addBusinessDays("2024-03-16", 1);
// "2024-03-18" (Saturday start: skip weekend, Monday is the first business day)

subtractBusinessDays("2024-03-17", 1);
// "2024-03-15" (Sunday start skips to Saturday, then -1 = Friday)

addBusinessDays("2024-03-15", 0);
// "2024-03-15" (zero returns the input unchanged)

addBusinessDays("invalid", 1);
// "" (sentinel on invalid input)
```

`addBusinessDays`/`subtractBusinessDays` skip Saturday and Sunday during the count. They use fixed ISO Monday–Friday business days with no locale parameter. Negative `amount` on `addBusinessDays` behaves identically to `subtractBusinessDays(value, Math.abs(amount))`, and vice versa.

To test whether a given date is itself a business day before doing arithmetic on it, use `isBusinessDay` (see the `compare-dates` skill) — it shares this exact fixed ISO Mon–Fri boundary.

### Round a diff result with smallestUnit/roundingIncrement/roundingMode

```ts
import { diffDate } from "@northguild/gmt";

// unrounded (default): exact difference in the requested unit
const exact = diffDate("2023-01-01", "2023-01-10", "day"); // 9

// round to the nearest week
const rounded = diffDate("2023-01-01", "2023-01-10", "week", {
  smallestUnit: "week",
  roundingMode: "halfExpand",
}); // 1
```

`smallestUnit`, `roundingIncrement`, and `roundingMode` are available on `diffDate`, `diffDateTime`, `diffTime`, `diffUnix`, `diffUtc`, and `diffZoned`. All default to no rounding (the prior, exact behavior) when omitted.

### Calendar-unit arithmetic on a non-Gregorian date (E5)

`addDate`, `subtractDate`, `diffDate`, and `diffDateAsDuration` accept a GMT calendar-annotated `PlainDate` string (as produced by `convertDateToCalendar`, e.g. `"5784-06-15[u-ca=hebrew]"`), not just a bare ISO string. Calendar-unit arithmetic ("add 1 month") resolves in that calendar:

```ts
import { addDate, convertDateToCalendar, diffDate } from "@northguild/gmt";

const adarI = convertDateToCalendar("2024-02-24", "hebrew"); // "5784-06-15[u-ca=hebrew]"
addDate(adarI, { months: 1 }); // "5784-07-15[u-ca=hebrew]" — Adar I (leap-only) -> Adar

diffDate(adarI, "5784-07-15[u-ca=hebrew]", "months"); // 1 — measured in Hebrew
diffDate(adarI, "2024-11-03", "days"); // falls back to Gregorian — the two arguments carry different (or no) calendar tags
```

Only `plain/` `PlainDate` functions accept this — `addDateTime`/`addTime`/`addZoned`/`addUtc`/`addUnix` and their `subtract*`/`diff*` siblings reject a calendar annotation (return the sentinel), since GMT has no calendar-annotated `PlainDateTime`/`ZonedDateTime`/UTC grammar and `PlainTime` has no calendar concept at all. `addBusinessDays`/`subtractBusinessDays` also reject it — weekday is calendar-independent in every supported calendar, so a tag would change nothing about the answer while implying it might. See `packages/gmt/README.md`'s "Calendar-aware interval and duration arithmetic" section and `context/roadmap/issues/E.md`'s E5 outcome for the full audit.

### Cycle a single field without changing others (E6)

```ts
import { cycleDate, cycleDateTime, cycleTime } from "@northguild/gmt";

cycleDate("2024-12-15", "month", 1); // "2024-01-15" — wraps, stays in the same year
cycleDate("2024-12-31", "day", 1); // "2024-12-01" — wraps within the same month
cycleDate("2024-01-15", "month", 13); // "2024-02-15" — an amount larger than the range still wraps correctly

cycleDateTime("2024-06-15T23:30:00", "hour", 1); // "2024-06-15T00:30:00" — wraps, stays on the same day
cycleTime("09:22:00", "minute", 15, { round: true }); // "09:30:00" — steps to the next multiple of 15, not the nearest

cycleDate("2024-06-15", "week", 1); // "" — "week" isn't a cyclable field (only year/month/day/hour/minute/second/ms/us/ns)
```

`cycleDate`/`cycleDateTime`/`cycleTime` are not `addDate`/`addDateTime`/`addTime`: they adjust one field and wrap at that field's own min/max instead of carrying into the next larger field. Cycling `month`/`year` can still clamp (or, with `overflow: "reject"`, reject) `day` — the same `.with()`-based clamping `setDate` documents — since they build on the same J1 field setters. `overflow` is accepted on `cycleTime` for signature consistency but is inert there: a cycled time field's wrapped value is always already in range. The `zoned/` equivalent, `cycleZoned`, lives in the `zoned-date-ops` skill since it also takes `disambiguation`/`offset`.

## Common Mistakes

### Doing calendar arithmetic and timezone arithmetic in two steps

`addZoned`/`subtractZoned` accept GMT's calendar-annotated zoned string and resolve the calendar
unit and the DST rules together:

```ts
addZoned("5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]", { months: 1 });
// "5784-07-15T14:30:00-04:00[u-ca=hebrew][America/New_York]" — Adar I -> Adar AND EST -> EDT
```

Splitting this into a `plain/` calendar step plus a zoned conversion gives the wrong answer in
either order: do the calendar step first and DST is applied to an already-resolved wall time; do
the zoned step first and there is no calendar left to step in. Note that `addZonedBusinessDays` /
`subtractZonedBusinessDays` still reject the annotation — day-of-week is ISO-fixed in every
supported calendar, so a tag would change nothing.

### Building a calendar-annotated zoned string by hand

GMT's zoned calendar grammar puts `[u-ca=...]` **before** `[timeZone]` — the reverse of RFC 9557
and of Temporal's own `toString()`:

```
5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]   // correct
5784-06-15T14:30:00-05:00[America/New_York][u-ca=hebrew]   // WRONG — silently misparses in Temporal
```

Always produce these with `convertZonedToCalendar`, never by concatenation. See the
`zoned-date-ops` skill's Common Mistakes for the full trap.

### HIGH Using manual date arithmetic

Wrong:

```ts
const date = new Date("2024-03-15");
date.setDate(date.getDate() + 5); // mutates original
```

Correct:

```ts
import { addDays } from "@northguild/gmt";

const result = addDays("2024-03-15", 5); // new immutable date
```

Source: AGENTS.md — Never mutate Date objects

### HIGH Not handling month overflow

Wrong:

```ts
const result = addMonths("2024-01-31", 1); // may throw or be incorrect
```

Correct:

```ts
import { addMonths } from "@northguild/gmt";

const result = addMonths("2024-01-31", 1); // "2024-03-02" (clamped to end of month)
```

Source: Temporal.PlainDate.add() — clamps to valid date

### MEDIUM Not handling invalid input

Wrong:

```ts
const result = addDays("invalid", 5);
// Assume result is valid date string
processDate(result);
```

Correct:

```ts
import { addDays, isValidDate } from "@northguild/gmt";

const input = "2024-03-15";
const result = addDays(input, 5);
if (!isValidDate(result)) {
  throw new Error("Invalid result");
}
```

Source: packages/gmt/src/plain/calculate/addDate.ts — Returns "" on invalid input

### MEDIUM Not handling leap year

Wrong:

```ts
const result = addDays("2024-02-28", 1);
const day = parseDayFromDate(result); // 28, 29, or 1?
```

Correct:

```ts
import { addDays } from "@northguild/gmt";

const result = addDays("2024-02-28", 1); // "2024-02-29" (correct for leap year)
```

Source: Temporal handles leap years automatically

### HIGH Reaching for cycleDate when calendar arithmetic is wanted (or vice versa)

Wrong:

```ts
// Trying to move a date forward by a month, but landing a year off:
const nextBillingDate = cycleDate("2024-12-15", "month", 1); // "2024-01-15" — same year!
```

Correct:

```ts
import { addDate, cycleDate } from "@northguild/gmt";

// Calendar arithmetic (crossing year boundaries is expected): use addDate
const nextBillingDate = addDate("2024-12-15", { months: 1 }); // "2025-01-15"

// Datepicker segment editing (year must NOT change when the month segment wraps): use cycleDate
const monthSegmentIncremented = cycleDate("2024-12-15", "month", 1); // "2024-01-15"
```

Source: packages/gmt/src/plain/calculate/cycleDate.ts — cycling wraps at the field's own boundary; adding overflows into the next field

## References

- [Full calculate API](references/calculate-api.md)
- [Temporal.PlainDate arithmetic](https://tc39.es/proposal-temporal/docs/plaindate.html#arithmetic)