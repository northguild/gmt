---
name: parse-date-time
description: >
  Parse individual components (year, month, day, hour, etc.) from
  date/time strings. Use parse* functions for extraction.
  Returns null on invalid input.
type: core
library: '@burglekitt/gmt'
library_version: '1.1.0'
sources:
  - 'burglekitt/gmt:packages/gmt/src/plain/parse/index.ts'
---

# Parse Date/Time Components

Use this skill when you need to extract a specific component (year, month, day, etc.) from a date or time string.

## Setup

```ts
import { parseYearFromDate, parseMonthFromDate, parseDayFromDate } from "@burglekitt/gmt";
import { parseHourFromTime, parseMinuteFromTime, parseSecondFromTime } from "@burglekitt/gmt";
```

## Core Patterns

### Parse year from date

```ts
const year = parseYearFromDate("2024-03-15"); // 2024
```

### Parse month from date

```ts
const month = parseMonthFromDate("2024-03-15"); // 3
```

### Parse day from date

```ts
const day = parseDayFromDate("2024-03-15"); // 15
```

### Parse hour from time

```ts
const hour = parseHourFromTime("14:30:45"); // 14
```

### Parse minute from time

```ts
const minute = parseMinuteFromTime("14:30:45"); // 30
```

### Parse second from time

```ts
const second = parseSecondFromTime("14:30:45"); // 45
```

### Parse from datetime string

```ts
import { parseYearFromDateTime, parseMonthFromDateTime, parseDayFromDateTime } from "@burglekitt/gmt";

const year = parseYearFromDateTime("2024-03-15T14:30:45"); // 2024
const month = parseMonthFromDateTime("2024-03-15T14:30:45"); // 3
const day = parseDayFromDateTime("2024-03-15T14:30:45"); // 15
```

### Parse day of week

```ts
import { parseDayOfWeekFromDate } from "@burglekitt/gmt";

const dayOfWeek = parseDayOfWeekFromDate("2024-03-15"); // 5 (Friday)
```

### Parse week of year

```ts
import { parseWeekFromDate } from "@burglekitt/gmt";

const week = parseWeekFromDate("2024-03-15"); // 11
```

## Common Mistakes

### HIGH Not handling null on invalid input

Wrong:

```ts
const year = parseYearFromDate("invalid");
// Assume year is always a number
console.log(year + 1); // NaN
```

Correct:

```ts
const year = parseYearFromDate("invalid");
if (year === null) {
  throw new Error("Invalid date");
}
console.log(year + 1);
```

Source: packages/gmt/src/plain/parse/parseYearFromDate.ts — Returns null on invalid input

### MEDIUM Using string manipulation instead of parse functions

Wrong:

```ts
const year = "2024-03-15".split("-")[0]; // "2024" as string
```

Correct:

```ts
import { parseYearFromDate } from "@burglekitt/gmt";

const year = parseYearFromDate("2024-03-15"); // 2024 as number
```

Source: AGENTS.md — Use Temporal for date manipulation

### MEDIUM Assuming month is 1-indexed in arithmetic

Wrong:

```ts
const month = parseMonthFromDate("2024-01-15");
// Use directly in array indexing
const monthName = ["Jan", "Feb", "Mar"][month]; // undefined
```

Correct:

```ts
const month = parseMonthFromDate("2024-01-15");
const monthName = ["Jan", "Feb", "Mar"][month - 1]; // "Jan"
```

Source: Temporal spec — months are 1-indexed

## References

- [Full parse API](references/parse-api.md)
- [Temporal.PlainDate documentation](https://tc39.es/proposal-temporal/docs/plaindate.html)