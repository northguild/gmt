---
"@northguild/gmt": patch
---

The core string validators now accept a value of any type (Story CORE-103). A value typed `unknown`, such as a function argument or the output of a schema check, needed a cast before you could ask whether it is valid. The functions already returned `false` for a value that is not a string, so for 26 of the 27 only the types change.

One result changes: `isValidTimeZone` returned `true` for a `Temporal.ZonedDateTime` whose `toString` gives a zone id. It now returns `false` for every value that is not a string.

- A value typed `unknown` needs no cast, and a `true` result narrows it to `string`. The three duration-unit predicates narrow it to their unit union.
- A `string` argument stays `string` when the result is `false`.
- A typed union such as `string | null` or `string | undefined` gets a plain `boolean` and is not narrowed. A `false` result does not show which part of the union the value is.
- `values.filter(isValidDate)` on an `unknown[]` gives `string[]`.

```typescript
import { isValidDate } from "@northguild/gmt";

declare const input: unknown;
if (isValidDate(input)) {
  input; // string
}
```

This covers 27 functions: `isValidDate`, `isValidDateTime`, `isValidTime`, `isValidYearMonth`, `isValidMonthDay`, `isValidCalendarDate`, `isValidIsoDateLike`, `isValidSqlDateTime`, `isValidDateDurationUnit`, `isValidDateTimeDurationUnit`, `isValidTimeDurationUnit`, `isValidZonedDateTime`, `isValidTimeZone`, `isValidCalendarZonedDateTime`, `isValidRfc2822DateTime`, `isValidRfc3339DateTime`, `isValidInstant`, `isValidInt64NanosecondDateTime`, `isValidInt64NanosecondInstant`, `isValidNanoPattern`, `isValidUtc`, `isValidHttpDate`, `isValidUtcTimestamp`, `isValidDuration`, `isValidUtcOffset`, `isValidEpcisEventTime` and `isValidEpcisTimeZoneOffset`.
