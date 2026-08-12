---
name: validate-dates
description: >
  Validate date/time strings, timezone identifiers, intervals, or ranges. Use isValidDate,
  isValidTime, isValidDateTime, isValidDateInterval, isValidTimeInterval, isValidDateTimeInterval
  for scalar and interval validation. Returns false on invalid input.
sources:
  - 'burglekitt/gmt:packages/gmt/src/plain/validate/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/plain/interval/validate/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/utc/validate/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/utc/interval/validate/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/validate/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/interval/validate/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/validate/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/interval/validate/index.ts'
metadata:
  type: core
  library: '@burglekitt/gmt'
  library_version: '1.9.0'
---

# Validate Dates

Use this skill when you need to validate date, time, or datetime strings before processing.

## Setup

```ts
import { isValidDate, isValidTime, isValidDateTime } from "@burglekitt/gmt";
import { isValidTimeZone, isValidZonedDateTime } from "@burglekitt/gmt/zoned";
```

## Core Patterns

### Validate ISO date string

```ts
const valid = isValidDate("2024-03-15"); // true
const invalid = isValidDate("2024-02-30"); // false (invalid day)
const invalidFormat = isValidDate("invalid"); // false
```

### Validate ISO time string

```ts
import { isValidTime } from "@burglekitt/gmt";

const valid = isValidTime("14:30:45"); // true
const invalid = isValidTime("25:00:00"); // false (invalid hour)
const invalidFormat = isValidTime("not a time"); // false
```

### Validate ISO datetime string

```ts
import { isValidDateTime } from "@burglekitt/gmt";

const valid = isValidDateTime("2024-03-15T14:30:45"); // true
const invalid = isValidDateTime("2024-02-30T14:30:45"); // false
```

### Validate IANA timezone

```ts
import { isValidTimeZone } from "@burglekitt/gmt/zoned";

const valid = isValidTimeZone("America/New_York"); // true
const invalid = isValidTimeZone("Invalid/Zone"); // false
```

### Validate zoned datetime string

```ts
import { isValidZonedDateTime } from "@burglekitt/gmt/zoned";

const valid = isValidZonedDateTime("2024-03-15T14:30:45[America/New_York]"); // true
const invalid = isValidZonedDateTime("2024-02-30T14:30:45[America/New_York]"); // false
```

### Validate date duration unit

```ts
import { isValidDateUnit } from "@burglekitt/gmt";

const valid = isValidDateUnit("day"); // true
const valid = isValidDateUnit("month"); // true
const valid = isValidDateUnit("year"); // true
const invalid = isValidDateUnit("invalid"); // false
```

### Validate time duration unit

```ts
import { isValidTimeUnit } from "@burglekitt/gmt";

const valid = isValidTimeUnit("hour"); // true
const valid = isValidTimeUnit("minute"); // true
const invalid = isValidTimeUnit("invalid"); // false
```

### Validate date interval

```ts
import { isValidDateInterval } from "@burglekitt/gmt";

const valid = isValidDateInterval("2024-01-01", "2024-12-31"); // true
const invalid = isValidDateInterval("2024-12-31", "2024-01-01"); // false (start > end)
const invalid = isValidDateInterval("not-a-date", "2024-12-31"); // false
```

### Validate time interval

```ts
import { isValidTimeInterval } from "@burglekitt/gmt";

const valid = isValidTimeInterval("09:00:00", "17:00:00"); // true
const invalid = isValidTimeInterval("25:00:00", "17:00:00"); // false (invalid start)
```

### Validate datetime interval

```ts
import { isValidDateTimeInterval } from "@burglekitt/gmt";

const valid = isValidDateTimeInterval("2024-01-01T09:00:00", "2024-12-31T17:00:00"); // true
const invalid = isValidDateTimeInterval("2024-12-31T17:00:00", "2024-01-01T09:00:00"); // false
```

### Validate UTC interval

```ts
import { isValidUtcInterval } from "@burglekitt/gmt/utc";

const valid = isValidUtcInterval("2024-01-01T09:00:00Z", "2024-12-31T17:00:00Z"); // true
const invalid = isValidUtcInterval("2024-12-31T17:00:00Z", "2024-01-01T09:00:00Z"); // false
```

### Validate Unix interval

```ts
import { isValidUnixInterval } from "@burglekitt/gmt/unix";

const valid = isValidUnixInterval("1704067200", "1704067800"); // true (seconds)
const validMs = isValidUnixInterval("1704067200000", "1704067800000"); // true (milliseconds)
const invalid = isValidUnixInterval("1704067800", "1704067200"); // false
```

### Validate zoned interval

```ts
import { isValidZonedInterval } from "@burglekitt/gmt/zoned";

const valid = isValidZonedInterval(
  "2024-01-01T09:00:00+00:00[UTC]",
  "2024-12-31T17:00:00+00:00[UTC]"
); // true
const invalid = isValidZonedInterval(
  "2024-12-31T17:00:00+00:00[UTC]",
  "2024-01-01T09:00:00+00:00[UTC]"
); // false
```

## Common Mistakes

### HIGH Not validating before parsing

Wrong:

```ts
const date = Temporal.PlainDate.from(input); // may throw
```

Correct:

```ts
import { isValidDate } from "@burglekitt/gmt";

if (!isValidDate(input)) {
  throw new Error("Invalid date");
}
const date = Temporal.PlainDate.from(input);
```

Source: AGENTS.md — Always validate before parsing

### HIGH Not validating timezone before use

Wrong:

```ts
const zoned = Temporal.ZonedDateTime.from("2024-03-15T14:30:45[Invalid/Zone]"); // may throw
```

Correct:

```ts
import { isValidTimeZone } from "@burglekitt/gmt/zoned";

if (!isValidTimeZone("America/New_York")) {
  throw new Error("Invalid timezone");
}
const zoned = Temporal.ZonedDateTime.from("2024-03-15T14:30:45[America/New_York]");
```

Source: packages/gmt/src/zoned/validate/isValidTimeZone.ts — Validates IANA timezone

### MEDIUM Using try-catch for validation

Wrong:

```ts
let valid = false;
try {
  Temporal.PlainDate.from(input);
  valid = true;
} catch {
  valid = false;
}
```

Correct:

```ts
import { isValidDate } from "@burglekitt/gmt";

const valid = isValidDate(input);
```

Source: AGENTS.md — Use validation functions, not exceptions for flow

### MEDIUM Confusing range validators with interval validators

Wrong:

```ts
import { isValidDateRange } from "@burglekitt/gmt";

isValidDateRange("2024-01-01", "2024-12-31"); // false — expects { value1, value2 }
```

Correct:

```ts
import { isValidDateInterval } from "@burglekitt/gmt";

const valid = isValidDateInterval("2024-01-01", "2024-12-31"); // true
```

Source: `plain/validate/isValidDateRange.ts` — range validators take `{ value1, value2, options? }`; interval validators take `(start, end)` positional args

### MEDIUM Assuming intervals accept reversed bounds

Wrong:

```ts
import { isValidDateInterval } from "@burglekitt/gmt";

const valid = isValidDateInterval("2024-12-31", "2024-01-01"); // false — start must be <= end
```

Correct:

```ts
const valid = isValidDateInterval("2024-01-01", "2024-12-31"); // true
```

Source: `plain/interval/validate/isValidDateInterval.ts` — interval validators enforce `start <= end`

## References

- [Full validate API](references/validate-api.md)
- [Temporal validation patterns](https://tc39.es/proposal-temporal/docs/iso.html)