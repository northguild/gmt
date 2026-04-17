---
name: convert-types
description: >
  Convert between temporal types, unix time, and UTC representations.
  Use convertPlainToZoned, convertZonedToPlain, convertUtcToUnix.
type: core
library: '@burglekitt/gmt'
library_version: '1.1.0'
sources:
  - 'burglekitt/gmt:packages/gmt/src/zoned/convert/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/convert/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/utc/convert/index.ts'
---

# Convert Temporal Types

Use this skill when you need to convert between different temporal representations.

## Setup

```ts
import { convertPlainToZoned, convertZonedToPlain } from "@burglekitt/gmt/zoned";
import { convertUtcToUnix, convertUnixToUtc } from "@burglekitt/gmt/unix";
import { convertUtcToZoned, convertZonedToUtc } from "@burglekitt/gmt/utc";
```

## Core Patterns

### Convert plain to zoned datetime

```ts
import { convertPlainToZoned } from "@burglekitt/gmt/zoned";

const zoned = convertPlainToZoned("2024-03-15T14:30:45", "America/New_York");
// "2024-03-15T14:30:45[America/New_York]"
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
const zoned = convertPlainToZoned("invalid", "America/New_York");
// Assume zoned is always valid
process(zoned);
```

Correct:

```ts
import { convertPlainToZoned, isValidTimeZone } from "@burglekitt/gmt/zoned";

if (!isValidTimeZone("America/New_York")) {
  throw new Error("Invalid timezone");
}
const zoned = convertPlainToZoned("2024-03-15T14:30:45", "America/New_York");
if (!zoned) {
  throw new Error("Conversion failed");
}
```

Source: packages/gmt/src/zoned/convert/convertPlainDateTimeToZoned.ts — Returns "" on error

## References

- [Full convert API](references/convert-api.md)
- [Unix epoch wikipedia](https://en.wikipedia.org/wiki/Unix_time)
- [IANA timezone database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)