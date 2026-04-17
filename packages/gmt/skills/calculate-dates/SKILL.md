---
name: calculate-dates
description: >
  Add or subtract time from dates. Use addDays, addMonths, subtractTime
  for date arithmetic. Use diffDate for calculating differences.
type: core
library: '@burglekitt/gmt'
library_version: '1.2.0'
sources:
  - 'burglekitt/gmt:packages/gmt/src/plain/calculate/index.ts'
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

### Calculate difference between dates (in days)

```ts
import { diffDate } from "@burglekitt/gmt";

const diff = diffDate("2024-03-15", "2024-03-20", "day"); // 5
```

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