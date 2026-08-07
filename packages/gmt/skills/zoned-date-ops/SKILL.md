---
name: zoned-date-ops
description: >
  Work with timezone-aware dates and times. Use IANA timezone identifiers for
  timezone-aware operations. Use getZonedNow, formatZonedDateTime,
  formatZonedRange for absolute formatting, and formatRelativeZoned for DST-safe
  relative output across timezones. Use getSystemTimeZone and getTimeZones for
  system timezone discovery and IANA timezone lists. Use
  convertPlainDateTimeToZoned to attach a timezone to a plain datetime, with an
  optional disambiguation option ("compatible" | "earlier" | "later" | "reject")
  to control DST gap/overlap resolution.
sources:
  - 'burglekitt/gmt:packages/gmt/src/zoned/get/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/format/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/validate/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/convert/index.ts'
metadata:
  type: core
  library: '@burglekitt/gmt'
  library_version: '1.4.0'
---

# Zoned Date Operations

Use this skill when you need timezone-aware date/time operations.

## Setup

```ts
import { getZonedNow, getZonedToday } from "@burglekitt/gmt/zoned";
import { getSystemTimeZone, getTimeZones } from "@burglekitt/gmt/zoned";
import { formatZonedDateTime } from "@burglekitt/gmt/zoned";
import { isValidTimeZone } from "@burglekitt/gmt/zoned";
```

## Core Patterns

### Get the system timezone

```ts
import { getSystemTimeZone } from "@burglekitt/gmt/zoned";

const tz = getSystemTimeZone(); // "America/New_York"
```

### Get all available IANA timezones

```ts
import { getTimeZones } from "@burglekitt/gmt/zoned";

const timeZones = getTimeZones(); // ["America/New_York", "Europe/London", ...]
timeZones.length; // ~422 (varies by runtime/ICU)
```

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

### Format zoned range

```ts
import { formatZonedRange } from "@burglekitt/gmt/zoned";

const from = "2024-02-29T10:00:00-05:00[America/New_York]";
const to = "2024-02-29T12:00:00-05:00[America/New_York]";
formatZonedRange(from, to, "en-US", { dateStyle: "long", timeStyle: "short" });
// "February 29, 2024, 10:00 AM – 12:00 PM"
```

> Both endpoints must share the same IANA timezone. Mismatched zones return `""`.

### Format relative zoned datetime (DST-safe)

```ts
import { formatRelativeZoned } from "@burglekitt/gmt/zoned";

const value = "2024-03-15T10:00:00-05:00[America/New_York]";
const reference = "2024-03-15T12:00:00-05:00[America/New_York]";
formatRelativeZoned(value, "en-US", { reference }); // "2 hours ago"
```

`formatRelativeZoned` computes the diff via `Temporal.ZonedDateTime` arithmetic, so it correctly handles DST transitions and spans that cross "fall back" / "spring forward" days.

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

### Attach a timezone to a plain datetime (with DST disambiguation)

```ts
import { convertPlainDateTimeToZoned } from "@burglekitt/gmt/zoned";

convertPlainDateTimeToZoned("2024-03-15T14:30:45", "America/New_York");
// "2024-03-15T14:30:45.000-04:00[America/New_York]"
```

Twice a year, the local time you pass in doesn't map 1:1 to a real instant:

- **Spring-forward gap**: clocks skip an hour, so a wall-clock time never happens (e.g. `2024-03-10T02:30:00` doesn't exist in `America/New_York`).
- **Fall-back overlap**: clocks repeat an hour, so a wall-clock time happens twice (e.g. `2024-11-03T01:30:00` occurs twice in `America/New_York`).

Pass `disambiguation` to control how that's resolved instead of silently guessing:

```ts
import { convertPlainDateTimeToZoned } from "@burglekitt/gmt/zoned";

// Gap: 2024-03-10T02:30:00 doesn't exist in America/New_York.
convertPlainDateTimeToZoned("2024-03-10T02:30:00", "America/New_York");
// "2024-03-10T03:30:00.000-04:00[America/New_York]" (default "compatible" == "later" for gaps)

convertPlainDateTimeToZoned("2024-03-10T02:30:00", "America/New_York", {
  disambiguation: "earlier",
});
// "2024-03-10T01:30:00.000-05:00[America/New_York]"

convertPlainDateTimeToZoned("2024-03-10T02:30:00", "America/New_York", {
  disambiguation: "reject",
});
// "" — no such local time exists

// Overlap: 2024-11-03T01:30:00 happens twice in America/New_York.
convertPlainDateTimeToZoned("2024-11-03T01:30:00", "America/New_York");
// "2024-11-03T01:30:00.000-04:00[America/New_York]" (default "compatible" == "earlier" for overlaps)

convertPlainDateTimeToZoned("2024-11-03T01:30:00", "America/New_York", {
  disambiguation: "later",
});
// "2024-11-03T01:30:00.000-05:00[America/New_York]"
```

`disambiguation` accepts `"compatible"` (default), `"earlier"`, `"later"`, or `"reject"`. See [DST Disambiguation](../../../../docs/dst-disambiguation.md) for the full explanation of gaps vs. overlaps.

## Timezone List

Common IANA timezone identifiers:

| Region | Example |
|--------|---------|
| US | America/New_York, America/Los_Angeles, America/Chicago |
| Europe | Europe/London, Europe/Paris, Europe/Berlin |
| Asia | Asia/Tokyo, Asia/Shanghai, Asia/Singapore |
| Pacific | Pacific/Auckland, Pacific/Honolulu |
| UTC | UTC |

## Runtime ICU data

Zoned formatters delegate locale and timezone-name rendering to the host runtime's `Intl.DateTimeFormat`. Output therefore depends on the ICU data shipped with the running Node (or browser):

- **Full ICU** runtimes (official Node binaries from nodejs.org, all modern browsers) return fully localized strings — e.g. `formatZonedDateTime(value, "ko-KR", { dateStyle: "full", timeStyle: "full" })` includes `"오후"` and the long Korean timezone name `"대한민국 표준시"`.
- **Small/partial ICU** runtimes (some Node builds compiled with `--with-intl=small-icu` or repackaged distributions) fall back to English day periods and shorter timezone names — the same call may return `"PM"`, `"한국 표준시"`, or offset strings like `"GMT+9"`/`"GMT+03:00"` in place of long zone names.

This is a property of the runtime, not gmt. For consistent non-English output, deploy on a full-ICU Node build or polyfill `Intl` with a package that bundles locale data.

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

### MEDIUM Ignoring DST gap/overlap ambiguity when converting a plain datetime

Wrong:

```ts
// Silently accepts whatever Temporal's default ("compatible") resolves to,
// even for a local time that's ambiguous (fall-back) or doesn't exist (spring-forward).
const zoned = convertPlainDateTimeToZoned("2024-11-03T01:30:00", "America/New_York");
```

Correct:

```ts
import { convertPlainDateTimeToZoned } from "@burglekitt/gmt/zoned";

// Be explicit about which occurrence you mean, or reject ambiguous input outright.
const zoned = convertPlainDateTimeToZoned("2024-11-03T01:30:00", "America/New_York", {
  disambiguation: "reject", // "" if this local time is ambiguous or nonexistent
});
```

Source: packages/gmt/src/zoned/convert/convertPlainDateTimeToZoned.ts — `disambiguation` option

## References

- [Full zoned API](references/zoned-api.md)
- [IANA timezone database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)
- [Temporal.ZonedDateTime](https://tc39.es/proposal-temporal/docs/zoneddatetime.html)