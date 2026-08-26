---
name: validate-dates
description: >
  Validate date/time strings, timezone identifiers, intervals, or ranges. Use
  isValidDate, isValidTime, isValidDateTime, isValidDateInterval,
  isValidTimeInterval, isValidDateTimeInterval for scalar and interval
  validation. Use hasDaylightSaving to check whether an IANA timezone observes
  daylight saving time. Use getDstTransitions to enumerate DST transition
  instants for a timezone in a given year. Use intervalContains*,
  intervalUnion*, and splitIntervalByUnit* for interval containment, merging,
  and splitting. All validation functions return false on invalid input;
  interval union returns null on disjoint or invalid input; split functions
  return [] on invalid input.
sources:
  - 'northguild/gmt:packages/gmt/src/plain/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/plain/interval/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/plain/interval/intervalContainsDate.ts'
  - 'northguild/gmt:packages/gmt/src/plain/interval/intervalContainsTime.ts'
  - 'northguild/gmt:packages/gmt/src/plain/interval/intervalContainsDateTime.ts'
  - 'northguild/gmt:packages/gmt/src/plain/interval/intervalUnionDate.ts'
  - 'northguild/gmt:packages/gmt/src/plain/interval/intervalUnionTime.ts'
  - 'northguild/gmt:packages/gmt/src/plain/interval/intervalUnionDateTime.ts'
  - 'northguild/gmt:packages/gmt/src/plain/interval/splitIntervalByUnitDate.ts'
  - 'northguild/gmt:packages/gmt/src/plain/interval/splitIntervalByUnitTime.ts'
  - 'northguild/gmt:packages/gmt/src/plain/interval/splitIntervalByUnitDateTime.ts'
  - 'northguild/gmt:packages/gmt/src/utc/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/utc/interval/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/utc/interval/intervalContainsUtc.ts'
  - 'northguild/gmt:packages/gmt/src/utc/interval/intervalUnionUtc.ts'
  - 'northguild/gmt:packages/gmt/src/utc/interval/splitIntervalByUnitUtc.ts'
  - 'northguild/gmt:packages/gmt/src/unix/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/unix/interval/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/unix/interval/intervalContainsUnix.ts'
  - 'northguild/gmt:packages/gmt/src/unix/interval/intervalUnionUnix.ts'
  - 'northguild/gmt:packages/gmt/src/unix/interval/splitIntervalByUnitUnix.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/validate/hasDaylightSaving.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/get/getDstTransitions.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/interval/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/interval/intervalContainsZoned.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/interval/intervalUnionZoned.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/interval/splitIntervalByUnitZoned.ts'
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.14.1'
---

# Validate Dates

Use this skill when you need to validate date, time, or datetime strings before processing.

## Setup

```ts
import { isValidDate, isValidTime, isValidDateTime } from "@northguild/gmt";
import { isValidTimeZone, isValidZonedDateTime } from "@northguild/gmt/zoned";
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
import { isValidTime } from "@northguild/gmt";

const valid = isValidTime("14:30:45"); // true
const invalid = isValidTime("25:00:00"); // false (invalid hour)
const invalidFormat = isValidTime("not a time"); // false
```

### Validate ISO datetime string

```ts
import { isValidDateTime } from "@northguild/gmt";

const valid = isValidDateTime("2024-03-15T14:30:45"); // true
const invalid = isValidDateTime("2024-02-30T14:30:45"); // false
```

### Validate IANA timezone

```ts
import { isValidTimeZone } from "@northguild/gmt/zoned";

const valid = isValidTimeZone("America/New_York"); // true
const invalid = isValidTimeZone("Invalid/Zone"); // false
```

### Validate zoned datetime string

```ts
import { isValidZonedDateTime } from "@northguild/gmt/zoned";

const valid = isValidZonedDateTime("2024-03-15T14:30:45[America/New_York]"); // true
const invalid = isValidZonedDateTime("2024-02-30T14:30:45[America/New_York]"); // false

// E5 (issue #78): a [u-ca=...] calendar annotation is always invalid here — calendar-system
// awareness is plain/ PlainDate only. Same rejection applies to isValidZonedInterval below and
// every zoned/interval/* function.
const rejected = isValidZonedDateTime(
  "2024-03-15T14:30:45-04:00[America/New_York][u-ca=hebrew]",
); // false
```

### Check daylight saving time

```ts
import { hasDaylightSaving } from "@northguild/gmt/zoned";

const hasDst = hasDaylightSaving("America/New_York"); // true
const noDst = hasDaylightSaving("Asia/Tokyo"); // false
const invalid = hasDaylightSaving("Invalid/Zone"); // false
```

### List DST transition instants

```ts
import { getDstTransitions } from "@northguild/gmt/zoned";

const transitions = getDstTransitions("America/New_York", 2024);
// [
//   { instant: "2024-03-10T07:00:00Z", offsetBefore: "-05:00", offsetAfter: "-04:00" },
//   { instant: "2024-11-03T06:00:00Z", offsetBefore: "-04:00", offsetAfter: "-05:00" }
// ]

const noTransitions = getDstTransitions("Asia/Tokyo", 2024);
// []
```

### Validate date duration unit

```ts
import { isValidDateUnit } from "@northguild/gmt";

const valid = isValidDateUnit("day"); // true
const valid = isValidDateUnit("month"); // true
const valid = isValidDateUnit("year"); // true
const invalid = isValidDateUnit("invalid"); // false
```

### Validate time duration unit

```ts
import { isValidTimeUnit } from "@northguild/gmt";

const valid = isValidTimeUnit("hour"); // true
const valid = isValidTimeUnit("minute"); // true
const invalid = isValidTimeUnit("invalid"); // false
```

### Validate date interval

```ts
import { isValidDateInterval } from "@northguild/gmt";

const valid = isValidDateInterval("2024-01-01", "2024-12-31"); // true
const invalid = isValidDateInterval("2024-12-31", "2024-01-01"); // false (start > end)
const invalid = isValidDateInterval("not-a-date", "2024-12-31"); // false

// E5 (issue #78): accepts GMT calendar-annotated PlainDate strings, and start/end may carry
// different calendars — ordering is calendar-independent.
const mixedCalendars = isValidDateInterval(
  "5785-01-01[u-ca=hebrew]",
  "2024-12-31",
); // true
```

### Validate time interval

```ts
import { isValidTimeInterval } from "@northguild/gmt";

const valid = isValidTimeInterval("09:00:00", "17:00:00"); // true
const invalid = isValidTimeInterval("25:00:00", "17:00:00"); // false (invalid start)
```

### Validate datetime interval

```ts
import { isValidDateTimeInterval } from "@northguild/gmt";

const valid = isValidDateTimeInterval("2024-01-01T09:00:00", "2024-12-31T17:00:00"); // true
const invalid = isValidDateTimeInterval("2024-12-31T17:00:00", "2024-01-01T09:00:00"); // false
```

### Validate UTC interval

```ts
import { isValidUtcInterval } from "@northguild/gmt/utc";

const valid = isValidUtcInterval("2024-01-01T09:00:00Z", "2024-12-31T17:00:00Z"); // true
const invalid = isValidUtcInterval("2024-12-31T17:00:00Z", "2024-01-01T09:00:00Z"); // false
```

### Validate Unix interval

```ts
import { isValidUnixInterval } from "@northguild/gmt/unix";

const valid = isValidUnixInterval("1704067200", "1704067800"); // true (seconds)
const validMs = isValidUnixInterval("1704067200000", "1704067800000"); // true (milliseconds)
const invalid = isValidUnixInterval("1704067800", "1704067200"); // false
```

### Validate zoned interval

```ts
import { isValidZonedInterval } from "@northguild/gmt/zoned";

const valid = isValidZonedInterval(
  "2024-01-01T09:00:00+00:00[UTC]",
  "2024-12-31T17:00:00+00:00[UTC]"
); // true
const invalid = isValidZonedInterval(
  "2024-12-31T17:00:00+00:00[UTC]",
  "2024-01-01T09:00:00+00:00[UTC]"
); // false
```

### Check point-in-interval (3-arg)

```ts
import { intervalContainsDate } from "@northguild/gmt";

const inside = intervalContainsDate("2024-01-01", "2024-12-31", "2024-06-15"); // true
const onBoundary = intervalContainsDate("2024-01-01", "2024-12-31", "2024-01-01"); // true
const outside = intervalContainsDate("2024-01-01", "2024-12-31", "2025-01-01"); // false
```

### Check interval-in-interval (4-arg)

```ts
import { intervalContainsDate } from "@northguild/gmt";

const inside = intervalContainsDate("2024-01-01", "2024-12-31", "2024-03-01", "2024-09-01"); // true
const equal = intervalContainsDate("2024-01-01", "2024-12-31", "2024-01-01", "2024-12-31"); // true
const partial = intervalContainsDate("2024-01-01", "2024-12-31", "2024-06-15", "2025-01-01"); // false
```

### Check time interval containment

```ts
import { intervalContainsTime } from "@northguild/gmt";

const inside = intervalContainsTime("09:00:00", "17:00:00", "12:00:00"); // true
const inner = intervalContainsTime("09:00:00", "17:00:00", "10:00:00", "16:00:00"); // true
```

### Check datetime interval containment

```ts
import { intervalContainsDateTime } from "@northguild/gmt";

const inside = intervalContainsDateTime("2024-01-01T10:00:00", "2024-12-31T23:59:59", "2024-06-15T12:00:00"); // true
const inner = intervalContainsDateTime("2024-01-01T10:00:00", "2024-12-31T23:59:59", "2024-03-01T00:00:00", "2024-09-01T00:00:00"); // true
```

### Check UTC interval containment

```ts
import { intervalContainsUtc } from "@northguild/gmt/utc";

const inside = intervalContainsUtc("2024-01-01T00:00:00Z", "2024-12-31T23:59:59Z", "2024-06-15T12:00:00Z"); // true
const inner = intervalContainsUtc("2024-01-01T00:00:00Z", "2024-12-31T23:59:59Z", "2024-03-01T00:00:00Z", "2024-09-01T00:00:00Z"); // true
```

### Check Unix interval containment

```ts
import { intervalContainsUnix } from "@northguild/gmt/unix";

const inside = intervalContainsUnix(0, 1700000000, 170000000); // true
const inner = intervalContainsUnix(0, 1700000000, 100000, 1000000); // true
const stringInput = intervalContainsUnix("0", "1700000000", "170000000"); // true
```

### Check zoned interval containment

```ts
import { intervalContainsZoned } from "@northguild/gmt/zoned";

const inside = intervalContainsZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]", "2024-06-15T12:00:00+00:00[UTC]"); // true
const inner = intervalContainsZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]", "2024-03-01T00:00:00+00:00[UTC]", "2024-09-01T00:00:00+00:00[UTC]"); // true
```

### Merge overlapping or adjacent intervals (union)

```ts
import { intervalUnionDate } from "@northguild/gmt";

const merged = intervalUnionDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31");
// { start: "2024-01-01", end: "2024-12-31" }

const adjacent = intervalUnionDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31");
// { start: "2024-01-01", end: "2024-12-31" } — adjacent intervals ARE merged

const disjoint = intervalUnionDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31");
// null — gap between intervals
```

`intervalUnionTime`, `intervalUnionDateTime`, `intervalUnionUtc`, `intervalUnionUnix`, and `intervalUnionZoned` follow the same pattern across their respective types. Unix returns `{ start: number; end: number } | null`; all others return `{ start: string; end: string } | null`.

### Split interval into sub-intervals by unit

```ts
import { splitIntervalByUnitDate } from "@northguild/gmt";

const slices = splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 2);
// [
//   { start: "2024-01-01", end: "2024-01-03" },
//   { start: "2024-01-03", end: "2024-01-05" },
//   { start: "2024-01-05", end: "2024-01-07" },
//   { start: "2024-01-07", end: "2024-01-09" },
//   { start: "2024-01-09", end: "2024-01-10" }
// ]
```

`splitIntervalByUnitTime`, `splitIntervalByUnitDateTime`, `splitIntervalByUnitUtc`, `splitIntervalByUnitUnix`, and `splitIntervalByUnitZoned` follow the same pattern. The final sub-interval is trimmed so its `end` never exceeds the original `end`. All split functions return `[]` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, non-positive amount, unsupported unit, or a unit that has no effect on the target type).

## Common Mistakes

### HIGH Not validating before parsing

Wrong:

```ts
const date = Temporal.PlainDate.from(input); // may throw
```

Correct:

```ts
import { isValidDate } from "@northguild/gmt";

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
import { isValidTimeZone } from "@northguild/gmt/zoned";

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
import { isValidDate } from "@northguild/gmt";

const valid = isValidDate(input);
```

Source: AGENTS.md — Use validation functions, not exceptions for flow

### MEDIUM Confusing range validators with interval validators

Wrong:

```ts
import { isValidDateRange } from "@northguild/gmt";

isValidDateRange("2024-01-01", "2024-12-31"); // false — expects { value1, value2 }
```

Correct:

```ts
import { isValidDateInterval } from "@northguild/gmt";

const valid = isValidDateInterval("2024-01-01", "2024-12-31"); // true
```

Source: `plain/validate/isValidDateRange.ts` — range validators take `{ value1, value2, options? }`; interval validators take `(start, end)` positional args

### MEDIUM Assuming intervals accept reversed bounds

Wrong:

```ts
import { isValidDateInterval } from "@northguild/gmt";

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