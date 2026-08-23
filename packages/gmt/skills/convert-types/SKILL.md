---
name: convert-types
description: >
  Convert between temporal types, unix time, and UTC representations. Use
  convertPlainDateTimeToZoned (with optional disambiguation for DST gaps/
  overlaps), convertZonedToPlainDateTime, convertUtcToUnix.
sources:
  - 'burglekitt/gmt:packages/gmt/src/plain/convert/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/convert/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/convert/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/utc/convert/index.ts'
metadata:
  type: core
  library: '@burglekitt/gmt'
  library_version: '1.13.0'
---

# Convert Temporal Types

Use this skill when you need to convert between different temporal representations.

## Setup

```ts
import { convertPlainDateTimeToZoned, convertZonedToPlainDateTime } from "@burglekitt/gmt/zoned";
import { convertUtcToUnix, convertUnixToUtc } from "@burglekitt/gmt/unix";
import { convertUtcToZoned, convertZonedToUtc } from "@burglekitt/gmt/utc";
```

## Core Patterns

### Convert plain to zoned datetime

```ts
import { convertPlainDateTimeToZoned } from "@burglekitt/gmt/zoned";

const zoned = convertPlainDateTimeToZoned("2024-03-15T14:30:45", "America/New_York");
// "2024-03-15T14:30:45[America/New_York]"
```

Twice a year, DST creates local times that don't exist (spring-forward gap) or happen twice (fall-back overlap). Pass `disambiguation` (`"compatible"` (default) | `"earlier"` | `"later"` | `"reject"`) to control resolution instead of silently guessing — see the [Zoned Date Operations skill](../zoned-date-ops/SKILL.md) for the full gap/overlap walkthrough:

```ts
convertPlainDateTimeToZoned("2024-03-10T02:30:00", "America/New_York", {
  disambiguation: "reject",
});
// "" — 2024-03-10T02:30:00 doesn't exist in America/New_York (spring-forward gap)
```

### Convert zoned to plain datetime

```ts
import { convertZonedToPlainDateTime } from "@burglekitt/gmt/zoned";

const plain = convertZonedToPlainDateTime("2024-03-15T14:30:45[America/New_York]");
// "2024-03-15T14:30:45"
```

### Convert UTC to Unix epoch (seconds)

```ts
import { convertUtcToUnix } from "@burglekitt/gmt/unix";

const unix = convertUtcToUnix("2024-03-15T14:30:45"); // 1710504645
```

### Convert Unix epoch to UTC (seconds)

```ts
import { convertUnixToUtc } from "@burglekitt/gmt/unix";

const utc = convertUnixToUtc(1710504645); // "2024-03-15T14:30:45"
```

### Convert UTC datetime to Unix milliseconds

```ts
import { convertUtcToUnixMs } from "@burglekitt/gmt/unix";

const unixMs = convertUtcToUnixMs("2024-03-15T14:30:45"); // 1710504645000
```

### Convert Unix milliseconds to UTC datetime

```ts
import { convertUnixMsToUtc } from "@burglekitt/gmt/unix";

const utc = convertUnixMsToUtc(1710504645000); // "2024-03-15T14:30:45"
```

### Convert zoned to UTC

```ts
import { convertZonedToUtc } from "@burglekitt/gmt/zoned";

const utc = convertZonedToUtc("2024-03-15T14:30:45[America/New_York]"); // "2024-03-15T19:30:45"
```

### Convert UTC to zoned

```ts
import { convertUtcToZoned } from "@burglekitt/gmt/utc";

const zoned = convertUtcToZoned("2024-03-15T14:30:45", "America/New_York"); // "2024-03-15T10:30:45[America/New_York]"
```

### Convert between timezones

```ts
import { convertZonedToZoned } from "@burglekitt/gmt/zoned";

const converted = convertZonedToZoned(
  "2024-03-15T14:30:45[America/New_York]",
  "Europe/London"
); // "2024-03-15T18:30:45[Europe/London]"
```

### Convert a date to a non-Gregorian calendar system

```ts
import { convertDateToCalendar } from "@burglekitt/gmt/plain";

const hebrew = convertDateToCalendar("2024-10-03", "hebrew");
// "5785-01-01[u-ca=hebrew]" — Rosh Hashanah 5785, calendar-native year/month/day

const back = convertDateToCalendar(hebrew, "gregorian");
// "2024-10-03" — round-trips back to a bare ISO string
```

`CalendarSystem` is `"gregorian" | "hebrew"` today (extended by later Story Group E stories). The annotated string carries the target calendar's own year/month/day — not the ISO/Gregorian digits Temporal's own `[u-ca=...]` string convention keeps — so a Hebrew year like 5785 is visible directly in the string. A plain, unannotated string is always the `"gregorian"` calendar and works with every other GMT function unchanged.

## Common Mistakes

### HIGH Using Date.getTime() for conversion

Wrong:

```ts
const unix = new Date("2024-03-15T14:30:45").getTime() / 1000; // manual conversion
```

Correct:

```ts
import { convertUtcToUnix } from "@burglekitt/gmt/unix";

const unix = convertUtcToUnix("2024-03-15T14:30:45"); // proper conversion
```

Source: AGENTS.md — Never use Date APIs

### HIGH Mixing epoch seconds and milliseconds

Wrong:

```ts
const timestamp = 1710504645; // seconds
new Date(timestamp); // treats as milliseconds, wrong date
```

Correct:

```ts
import { convertUnixToUtc } from "@burglekitt/gmt/unix";

const timestamp = 1710504645; // seconds
const utc = convertUnixToUtc(timestamp);
```

Source: packages/gmt/src/unix/convert/convertUnixToUtc.ts — expects seconds

### MEDIUM Not handling conversion errors

Wrong:

```ts
const zoned = convertPlainDateTimeToZoned("invalid", "America/New_York");
// Assume zoned is always valid
process(zoned);
```

Correct:

```ts
import { convertPlainDateTimeToZoned, isValidTimeZone } from "@burglekitt/gmt/zoned";

if (!isValidTimeZone("America/New_York")) {
  throw new Error("Invalid timezone");
}
const zoned = convertPlainDateTimeToZoned("2024-03-15T14:30:45", "America/New_York");
if (!zoned) {
  throw new Error("Conversion failed");
}
```

Source: packages/gmt/src/zoned/convert/convertPlainDateTimeToZoned.ts — Returns "" on error

### MEDIUM Assuming a `[u-ca=...]` string means Temporal's own convention

Wrong:

```ts
// Assuming the digits are still the ISO/Gregorian year, like Temporal.PlainDate's own
// toString() would produce
const hebrew = convertDateToCalendar("2024-10-03", "hebrew"); // "5785-01-01[u-ca=hebrew]"
const year = hebrew.slice(0, 4); // "5785" is the Hebrew year, NOT 2024 — don't assume ISO digits
```

Correct: treat the annotated string as GMT's own format (calendar-native fields, produced/consumed only by `convertDateToCalendar`) — never hand-parse it or assume it matches `Temporal.PlainDate.prototype.toString()`'s own `[u-ca=...]` output, which keeps the ISO digits and only tags the calendar. Round-trip it through `convertDateToCalendar` itself instead of extracting fields manually.

Source: packages/gmt/src/plain/convert/convertDateToCalendar.ts — see JSDoc for the full rationale

## References

- [Full convert API](references/convert-api.md)
- [Unix epoch wikipedia](https://en.wikipedia.org/wiki/Unix_time)
- [IANA timezone database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)