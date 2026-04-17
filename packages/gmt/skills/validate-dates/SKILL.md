---
name: validate-dates
description: >
  Validate date/time strings or timezone identifiers.
  Use isValidDate, isValidTime, isValidDateTime for validation.
  Returns false on invalid input.
type: core
library: '@burglekitt/gmt'
library_version: '1.2.0'
sources:
  - 'burglekitt/gmt:packages/gmt/src/plain/validate/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/validate/index.ts'
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

## References

- [Full validate API](references/validate-api.md)
- [Temporal validation patterns](https://tc39.es/proposal-temporal/docs/iso.html)