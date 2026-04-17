---
name: zoned-date-ops
description: >
  Work with timezone-aware dates and times. Use IANA timezone identifiers
  for timezone-aware operations. Use getZonedNow, formatZonedDateTime.
type: core
library: '@burglekitt/gmt'
library_version: '1.1.0'
sources:
  - 'burglekitt/gmt:packages/gmt/src/zoned/get/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/format/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/validate/index.ts'
---

# Zoned Date Operations

Use this skill when you need timezone-aware date/time operations.

## Setup

```ts
import { getZonedNow, getZonedToday } from "@burglekitt/gmt/zoned";
import { formatZonedDateTime } from "@burglekitt/gmt/zoned";
import { isValidTimeZone } from "@burglekitt/gmt/zoned";
```

## Core Patterns

### Get current time in timezone

```ts
import { getZonedNow } from "@burglekitt/gmt/zoned";

const now = getZonedNow("America/New_York"); // "2024-03-15T10:30:45"
```

### Get current date in timezone

```ts
import { getZonedToday } from "@burglekitt/gmt/zoned";

const today = getZonedToday("America/New_York"); // "2024-03-15"
```

### Get current time in UTC

```ts
import { getZonedNow } from "@burglekitt/gmt/zoned";

const utcNow = getZonedNow("UTC"); // "2024-03-15T14:30:45"
```

### Get current time in Europe/London

```ts
import { getZonedNow } from "@burglekitt/gmt/zoned";

const londonNow = getZonedNow("Europe/London"); // "2024-03-15T14:30:45"
```

### Format zoned datetime

```ts
import { formatZonedDateTime } from "@burglekitt/gmt/zoned";

const formatted = formatZonedDateTime("2024-03-15T14:30:45[America/New_York]", "en-US");
// "3/15/2024, 10:30:45 AM"
```

### Validate timezone

```ts
import { isValidTimeZone } from "@burglekitt/gmt/zoned";

const valid = isValidTimeZone("America/New_York"); // true
const invalid = isValidTimeZone("Invalid/Zone"); // false
```

### Parse timezone from zoned string

```ts
import { parseTimezoneFromZoned } from "@burglekitt/gmt/zoned";

const tz = parseTimezoneFromZoned("2024-03-15T14:30:45[America/New_York]"); // "America/New_York"
```

### Get zoned date components

```ts
import { getYear, getMonth, getDay } from "@burglekitt/gmt/zoned";

const zoned = "2024-03-15T14:30:45[America/New_York]";
getYear(zoned); // 2024
getMonth(zoned); // 3
getDay(zoned); // 15
```

## Timezone List

Common IANA timezone identifiers:

| Region | Example |
|--------|---------|
| US | America/New_York, America/Los_Angeles, America/Chicago |
| Europe | Europe/London, Europe/Paris, Europe/Berlin |
| Asia | Asia/Tokyo, Asia/Shanghai, Asia/Singapore |
| Pacific | Pacific/Auckland, Pacific/Honolulu |
| UTC | UTC |

## Common Mistakes

### HIGH Using offset instead of IANA timezone

Wrong:

```ts
const zoned = "2024-03-15T14:30:45-05:00"; // offset, not timezone
```

Correct:

```ts
import { isValidTimeZone } from "@burglekitt/gmt/zoned";

const zoned = "2024-03-15T14:30:45[America/New_York]"; // IANA timezone
```

Source: Temporal spec — requires IANA timezone identifier

### HIGH Not validating timezone before use

Wrong:

```ts
const time = getZonedNow("Invalid/Zone"); // may return ""
```

Correct:

```ts
import { getZonedNow, isValidTimeZone } from "@burglekitt/gmt/zoned";

const tz = "America/New_York";
if (!isValidTimeZone(tz)) {
  throw new Error("Invalid timezone");
}
const time = getZonedNow(tz);
```

Source: packages/gmt/src/zoned/validate/isValidTimeZone.ts — Validate first

### MEDIUM DST not handled

Wrong:

```ts
// Assume same behavior year-round
const time = getZonedNow("America/New_York"); // different in summer vs winter
```

Correct:

```ts
// Temporal handles DST automatically
import { getZonedNow } from "@burglekitt/gmt/zoned";

const time = getZonedNow("America/New_York");
// Returns correct time regardless of DST
```

Source: Temporal.ZonedDateTime — handles DST transitions

## References

- [Full zoned API](references/zoned-api.md)
- [IANA timezone database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)
- [Temporal.ZonedDateTime](https://tc39.es/proposal-temporal/docs/zoneddatetime.html)