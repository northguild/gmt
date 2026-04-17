---
name: compare-dates
description: >
  Compare date values for ordering. Use isAfterDate, isBeforeDate, areDatesEqual
  for comparisons. Returns false on invalid input.
type: core
library: '@burglekitt/gmt'
library_version: '1.2.0'
sources:
  - 'burglekitt/gmt:packages/gmt/src/plain/compare/index.ts'
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

## References

- [Full compare API](references/compare-api.md)
- [Temporal.PlainDate comparison](https://tc39.es/proposal-temporal/docs/plaindate.html#comparison)