---
name: calculate-dates
description: >
  Add or subtract time from dates. Use addDays, addMonths, subtractTime for date
  arithmetic. Use addBusinessDays/subtractBusinessDays for Mon–Fri business-day
  arithmetic that skips weekends. Use diffDate for calculating differences. Use
  clampDate to restrict a date to a range, or closestDateTo to find the nearest
  candidate by calendar distance. add*/subtract* accept an optional overflow
  ("constrain" | "reject") option; diff* accept optional
  smallestUnit/roundingIncrement/roundingMode options to round the result. Use
  getLocaleStartOfWeek/getLocaleEndOfWeek for locale-driven week boundaries
  (first day of week derived from the locale, e.g. en-US Sunday vs fr-FR Monday)
  instead of startOfDate/endOfDate's ISO-biased weekStartsOn option.
sources:
  - 'burglekitt/gmt:packages/gmt/src/plain/calculate/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/plain/calculate/clampDate.ts'
  - 'burglekitt/gmt:packages/gmt/src/plain/calculate/closestDateTo.ts'
metadata:
  type: core
  library: '@burglekitt/gmt'
  library_version: '1.12.0'
---

# Calculate Dates

Use this skill when you need to perform date arithmetic (add, subtract, diff).

## Setup

```ts
import { addDays, addMonths, addYears } from "@burglekitt/gmt";
import { subtractTime, diffDate } from "@burglekitt/gmt";
import { startOfDate, endOfDate } from "@burglekitt/gmt";
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
import { subtractTime } from "@burglekitt/gmt";

const result = subtractTime("2024-03-15T14:30:45", { hours: 2 }); // "2024-03-15T12:30:45"
```

### Add business days (skip weekends)

```ts
import { addBusinessDays, subtractBusinessDays } from "@burglekitt/gmt";

addBusinessDays("2024-03-15", 1); // "2024-03-18" — skips Sat/Sun
addBusinessDays("2024-03-16", 1); // "2024-03-18" — Saturday start still skips to Monday

subtractBusinessDays("2024-03-18", 1); // "2024-03-15"
subtractBusinessDays("2024-03-17", 1); // "2024-03-15" — Sunday start still skips to Friday
```

### Calculate difference between dates (in days)

```ts
import { diffDate } from "@burglekitt/gmt";

const diff = diffDate("2024-03-15", "2024-03-20", "day"); // 5
```

Need a full multi-unit breakdown (e.g. `"P26D"`) instead of a single-unit number? See the `durations` skill's `diffDateAsDuration`/`diffDateTimeAsDuration`/`diffZonedAsDuration`/`diffUnixAsDuration`/`diffUtcAsDuration` bridge functions.

### Get start of day

```ts
import { startOfDate } from "@burglekitt/gmt";

const start = startOfDate("2024-03-15T14:30:45"); // "2024-03-15T00:00:00"
```

### Get end of day

```ts
import { endOfDate } from "@burglekitt/gmt";

const end = endOfDate("2024-03-15T14:30:45"); // "2024-03-15T23:59:59.999999999"
```

### Get start of month

```ts
import { startOfDate } from "@burglekitt/gmt";

const start = startOfDate("2024-03-15", "month"); // "2024-03-01"
```

### Get end of month

```ts
import { endOfDate } from "@burglekitt/gmt";

const end = endOfDate("2024-03-15", "month"); // "2024-03-31"
```

### Get quarter boundaries

```ts
import { startOfQuarterForDate, endOfQuarterForDate } from "@burglekitt/gmt";

const q1Start = startOfQuarterForDate("2024-03-15"); // "2024-01-01"
const q1End = endOfQuarterForDate("2024-03-15"); // "2024-03-31"
```

### Clamp a date to a range

```ts
import { clampDate } from "@burglekitt/gmt";

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
import { closestDateTo } from "@burglekitt/gmt";

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
import { getLocaleStartOfWeek, getLocaleEndOfWeek } from "@burglekitt/gmt";

getLocaleStartOfWeek("2024-02-29", "en-US"); // "2024-02-25" (Sunday, en-US weeks start Sunday)
getLocaleStartOfWeek("2024-02-29", "fr-FR"); // "2024-02-26" (Monday, fr-FR weeks start Monday)

getLocaleEndOfWeek("2024-02-29", "en-US"); // "2024-03-02" (Saturday)
getLocaleEndOfWeek("2024-02-29", "fr-FR"); // "2024-03-03" (Sunday)
```

Unlike `startOfDate(value, "week", { weekStartsOn })`/`endOfDate(value, "week", { weekStartsOn })`, which take an explicit ISO-biased `weekStartsOn` (`"monday"` | `"sunday"`, default `"monday"`), `getLocaleStartOfWeek`/`getLocaleEndOfWeek` derive the week's first day automatically from the locale via `Intl.Locale.prototype.weekInfo`, falling back to Monday if the runtime can't resolve `weekInfo` for the locale. Both return `""` for invalid `value` or an unresolvable `locale`. Zoned equivalents (`getLocaleZonedStartOfWeek`/`getLocaleZonedEndOfWeek`) live in the `zoned-date-ops` skill.

### Control out-of-range add/subtract results with overflow

```ts
import { addDate } from "@burglekitt/gmt";

// default overflow: "constrain" clamps to the nearest valid date
const clamped = addDate("2024-01-31", { months: 1 }); // "2024-02-29"

// overflow: "reject" returns the sentinel instead of clamping
const rejected = addDate("2024-01-31", { months: 1 }, { overflow: "reject" }); // ""
```

`overflow` is available on `addDate`, `addDateTime`, `addTime`, `addUnix`, `addUtc`, `addZoned`, and their `subtract` equivalents. It defaults to `"constrain"` (matches prior behavior) and is accepted-but-inert on `addTime`/`subtractTime`, since `PlainTime` arithmetic always wraps around the clock rather than producing an out-of-range value.

### Add/subtract business days (Mon–Fri only)

```ts
import { addBusinessDays, subtractBusinessDays } from "@burglekitt/gmt";

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
import { diffDate } from "@burglekitt/gmt";

// unrounded (default): exact difference in the requested unit
const exact = diffDate("2023-01-01", "2023-01-10", "day"); // 9

// round to the nearest week
const rounded = diffDate("2023-01-01", "2023-01-10", "week", {
  smallestUnit: "week",
  roundingMode: "halfExpand",
}); // 1
```

`smallestUnit`, `roundingIncrement`, and `roundingMode` are available on `diffDate`, `diffDateTime`, `diffTime`, `diffUnix`, `diffUtc`, and `diffZoned`. All default to no rounding (the prior, exact behavior) when omitted.

## Common Mistakes

### HIGH Using manual date arithmetic

Wrong:

```ts
const date = new Date("2024-03-15");
date.setDate(date.getDate() + 5); // mutates original
```

Correct:

```ts
import { addDays } from "@burglekitt/gmt";

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
import { addMonths } from "@burglekitt/gmt";

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
import { addDays, isValidDate } from "@burglekitt/gmt";

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
import { addDays } from "@burglekitt/gmt";

const result = addDays("2024-02-28", 1); // "2024-02-29" (correct for leap year)
```

Source: Temporal handles leap years automatically

## References

- [Full calculate API](references/calculate-api.md)
- [Temporal.PlainDate arithmetic](https://tc39.es/proposal-temporal/docs/plaindate.html#arithmetic)