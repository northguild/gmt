---
name: zoned-date-ops
description: >
  Work with timezone-aware dates and times using IANA timezone identifiers. Use
  getZonedNow, formatZonedDateTime, formatZonedRange, formatRelativeZoned,
  getSystemTimeZone, getTimeZones for basics. Use convertPlainDateTimeToZoned,
  addZoned, subtractZoned, startOfZoned, endOfZoned, startOfQuarterForZoned,
  endOfQuarterForZoned, mapZonedHoursInDay, getLocaleZonedStartOfWeek,
  getLocaleZonedEndOfWeek, clampZoned, closestZonedTo for DST-aware
  construction, arithmetic, boundaries, and locale-week computations. Most
  accept disambiguation ("compatible" | "earlier" | "later" | "reject") for
  gap/overlap resolution; boundary functions also accept offset ("prefer" |
  "use" | "ignore" | "reject", default "ignore").
sources:
  - 'burglekitt/gmt:packages/gmt/src/zoned/get/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/format/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/validate/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/convert/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/addZoned.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/subtractZoned.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/startOfZoned.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/endOfZoned.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/startOfQuarterForZoned.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/endOfQuarterForZoned.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/getLocaleZonedStartOfWeek.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/getLocaleZonedEndOfWeek.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/clampZoned.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/closestZonedTo.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/map/mapZonedHoursInDay.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/calculate/startOfUnix.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/calculate/endOfUnix.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/calculate/startOfQuarterForUnix.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/calculate/endOfQuarterForUnix.ts'
metadata:
  type: core
  library: '@burglekitt/gmt'
  library_version: '1.10.0'
---

# Zoned Date Operations

Use this skill when you need timezone-aware date/time operations.

## Setup

```ts
import {
  getZonedNow, getZonedToday, getSystemTimeZone, getTimeZones,
  isValidTimeZone, formatZonedDateTime, formatZonedRange, formatRelativeZoned,
  convertPlainDateTimeToZoned, addZoned, subtractZoned,
  startOfZoned, endOfZoned, startOfQuarterForZoned, endOfQuarterForZoned,
  getLocaleZonedStartOfWeek, getLocaleZonedEndOfWeek,
  clampZoned, closestZonedTo, mapZonedHoursInDay
} from "@burglekitt/gmt/zoned";
```

## Core Patterns

### Get current time in a timezone

```ts
const now = getZonedNow("America/New_York"); // "2024-03-15T10:30:45"
const today = getZonedToday("America/New_York"); // "2024-03-15"
```

### Format zoned datetime

```ts
formatZonedDateTime("2024-03-15T14:30:45[America/New_York]", "en-US");
// "3/15/2024, 10:30:45 AM"
```

### Format zoned range

```ts
const from = "2024-02-29T10:00:00-05:00[America/New_York]";
const to = "2024-02-29T12:00:00-05:00[America/New_York]";
formatZonedRange(from, to, "en-US", { dateStyle: "long", timeStyle: "short" });
// "February 29, 2024, 10:00 AM – 12:00 PM"
```

> Both endpoints must share the same IANA timezone. Mismatched zones return `""`.

### Format relative zoned datetime (DST-safe)

```ts
const value = "2024-03-15T10:00:00-05:00[America/New_York]";
const reference = "2024-03-15T12:00:00-05:00[America/New_York]";
formatRelativeZoned(value, "en-US", { reference }); // "2 hours ago"
```

`formatRelativeZoned` computes the diff via `Temporal.ZonedDateTime` arithmetic, so it correctly handles DST transitions.

### Validate and parse timezone

```ts
isValidTimeZone("America/New_York"); // true
parseTimezoneFromZoned("2024-03-15T14:30:45[America/New_York]"); // "America/New_York"
```

### Get zoned date components

```ts
const zoned = "2024-03-15T14:30:45[America/New_York]";
getYear(zoned); // 2024
getMonth(zoned); // 3
getDay(zoned); // 15
```

### Convert plain datetime to zoned (with DST disambiguation)

```ts
convertPlainDateTimeToZoned("2024-03-15T14:30:45", "America/New_York");
// "2024-03-15T14:30:45.000-04:00[America/New_York]"
```

Pass `disambiguation` to control gap/overlap resolution: `"compatible"` (default), `"earlier"`, `"later"`, or `"reject"`. See [DST Disambiguation](../../../../docs/dst-disambiguation.md).

### Add/subtract duration from zoned datetime

```ts
addZoned("2024-03-15T14:30:45[America/New_York]", { days: 1 });
// "2024-03-16T14:30:45-04:00[America/New_York]"
```

Same `disambiguation` option, but it only affects fall-back overlaps — it has **no effect** on spring-forward gaps. See [DST Disambiguation](../../../../docs/dst-disambiguation.md#which-function-do-i-actually-need).

### Jump to boundary (start/end of unit, quarter, hours-in-day)

```ts
startOfZoned("2024-03-15T14:30:45[America/New_York]", "month");
// "2024-03-01T00:00:00-05:00[America/New_York]"

endOfZoned("2024-03-15T14:30:45[America/New_York]", "hour");
// "2024-03-15T14:59:59.999999999-04:00[America/New_York]"
```

These accept `disambiguation` (full gap/overlap control) and `offset` (`"prefer" | "use" | "ignore" | "reject"`, default `"ignore"`). Leave `offset` at default unless you deliberately need Temporal's raw `.with()` semantics. See [The offset parameter](../../../../docs/dst-disambiguation.md#the-offset-parameter).

### Locale-aware week boundaries

```ts
getLocaleZonedStartOfWeek("2024-02-29T12:00:00+00:00[UTC]", "en-US");
// "2024-02-25T00:00:00+00:00[UTC]" (Sunday)

getLocaleZonedStartOfWeek("2024-02-29T12:00:00+00:00[UTC]", "fr-FR");
// "2024-02-26T00:00:00+00:00[UTC]" (Monday)
```

Derives the week's first day from the locale (same as plain `getLocaleStartOfWeek`/`getLocaleEndOfWeek`). Accepts `disambiguation`/`offset` options; `offset` must stay at `"ignore"` for `disambiguation` to take effect.

### Clamp a zoned datetime to a range

```ts
clampZoned(
  "2024-03-15T12:00:00[America/New_York]",
  "2024-03-01T00:00:00[America/New_York]",
  "2024-03-31T23:59:59[America/New_York]",
);
// "2024-03-15T12:00:00-04:00[America/New_York]"
```

### Find nearest zoned datetime to a target

```ts
closestZonedTo(
  "2024-03-15T12:00:00[America/New_York]",
  ["2024-03-01T00:00:00[America/New_York]", "2024-03-20T00:00:00[America/New_York]"],
);
// "2024-03-18T00:00:00-04:00[America/New_York]"
```

Returns `null` for empty candidates or invalid target.

## Timezone Reference

See [references/timezones.md](references/timezones.md) for common IANA timezone identifiers.

## Runtime ICU Data

Zoned formatters delegate locale and timezone-name rendering to the host runtime's `Intl.DateTimeFormat`. Output depends on ICU data shipped with the running Node or browser. For consistent non-English output, deploy on a full-ICU Node build or polyfill `Intl`.

## Common Mistakes

### Using offset instead of IANA timezone

Wrong: `"2024-03-15T14:30:45-05:00"`
Correct: `"2024-03-15T14:30:45[America/New_York]"`

### Not validating timezone before use

Wrong: `getZonedNow("Invalid/Zone")` — may return `""`
Correct: validate with `isValidTimeZone()` first.

### Assuming `addZoned`/`subtractZoned` rejects DST gaps

`disambiguation: "reject"` only catches fall-back overlaps, not spring-forward gaps. Use `convertPlainDateTimeToZoned` with `disambiguation: "reject"` if you need gap-safety.

### Passing `offset: "prefer"` with `disambiguation`

`offset: "prefer"` keeps the source's offset before disambiguation is consulted, so `disambiguation` never fires. Leave `offset` at its default `"ignore"`.

## References

- [Common IANA timezones](references/timezones.md)
- [DST Disambiguation](../../../../docs/dst-disambiguation.md)
- [Temporal.ZonedDateTime](https://tc39.es/proposal-temporal/docs/zoneddatetime.html)
