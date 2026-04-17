---
name: get-current
description: >
  Get the current date, time, or datetime as ISO 8601 strings.
  Use getNow(), getToday(), or Temporal.Now for current temporal values.
  String output for logging; use Temporal for manipulation.
type: core
library: '@burglekitt/gmt'
library_version: '1.2.0'
sources:
  - 'burglekitt/gmt:packages/gmt/src/plain/get/getNow.ts'
  - 'burglekitt/gmt:packages/gmt/src/plain/get/getToday.ts'
  - 'burglekitt/gmt:packages/gmt/src/utc/get/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/get/index.ts'
---

# Get Current Date/Time

Use this skill when you need to get the current date, time, or datetime.

## Setup

```ts
import { getNow, getToday } from "@burglekitt/gmt";
import { getUtcNow, getUtcToday } from "@burglekitt/gmt/utc";
import { getUnixNow, getUnixTimeMs } from "@burglekitt/gmt/unix";
```

## Core Patterns

### Get current local date

```ts
// Returns current date as ISO string in system timezone
const today = getToday(); // "2024-03-15"
```

### Get current local datetime

```ts
// Returns current datetime as ISO string in system timezone
const now = getNow(); // "2024-03-15T14:30:45"
```

### Get current UTC date

```ts
import { getUtcToday } from "@burglekitt/gmt/utc";

const utcToday = getUtcToday(); // "2024-03-15"
```

### Get current UTC datetime

```ts
import { getUtcNow } from "@burglekitt/gmt/utc";

const utcNow = getUtcNow(); // "2024-03-15T14:30:45"
```

### Get current Unix timestamp (seconds)

```ts
import { getUnixNow } from "@burglekitt/gmt/unix";

const unixNow = getUnixNow(); // 1710504645
```

### Get current Unix timestamp (milliseconds)

```ts
import { getUnixTimeMs } from "@burglekitt/gmt/unix";

const unixMs = getUnixTimeMs(); // 1710504645000
```

### Using Temporal directly for manipulation

```ts
import { Temporal } from "@js-temporal/polyfill";

// Current instant for precise timing
const instant = Temporal.Now.instant(); // Temporal.Instant

// Current plain date in system timezone
const plainDate = Temporal.Now.plainDateISO(); // Temporal.PlainDate

// Current plain datetime in system timezone
const plainDateTime = Temporal.Now.plainDateTimeISO(); // Temporal.PlainDateTime

// Current zoned datetime in system timezone
const zonedDateTime = Temporal.Now.zonedDateTimeISO("America/New_York"); // Temporal.ZonedDateTime
```

## Common Mistakes

### CRITICAL Using Date.now() instead of Temporal

Wrong:

```ts
const now = Date.now(); // returns milliseconds number
```

Correct:

```ts
import { getUnixNow } from "@burglekitt/gmt/unix";

const now = getUnixNow(); // returns number in seconds
```

Source: AGENTS.md — Never use JavaScript Date APIs

### HIGH Using new Date() for current time

Wrong:

```ts
const now = new Date(); // mutable Date object
```

Correct:

```ts
import { getNow } from "@burglekitt/gmt";

const now = getNow(); // immutable ISO string
```

Source: AGENTS.md — String-only inputs/outputs

### MEDIUM Not handling empty string on error

Wrong:

```ts
const now = getToday();
// Assume now is always valid
process(now);
```

Correct:

```ts
const now = getToday();
if (!now) {
  throw new Error("Failed to get current date");
}
process(now);
```

Source: packages/gmt/src/plain/get/getNow.ts — Returns "" on error

## References

- [Full get API](references/get-api.md)
- [Temporal.Now documentation](https://tc39.es/proposal-temporal/docs/now.html)