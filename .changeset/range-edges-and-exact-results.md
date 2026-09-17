---
"@northguild/gmt": patch
---

Return exact answers at Temporal's range limits and for very large or very precise values (Story CORE-8).

**Answers that exist at the edge of the range.** Temporal represents dates from `-271821-04-19` to `+275760-09-13`. Several functions built a boundary they did not need, such as the start of the next year or the 1st of a month before the first date, and returned their sentinel when that boundary fell outside the range. The affected functions were `roundDate`, `roundDateTime`, `bucketRange`, the `splitIntervalByUnit*` functions, `mapDatesInRange`, `mapZonedDatesInRange`, `getWeekOfMonth`, `getWeeksInMonth`, `getWeeksInYear`, `getLocaleWeekYear` and `getWeeksInLocaleWeekYear`. The `intervalCount*` functions also returned `null` at the minimum. Each now builds a boundary only when the answer needs it, and returns the answer.

```typescript
import { bucketRange, getWeekOfMonth, intervalCountZoned, roundDate } from "@northguild/gmt";

roundDate("+275760-06-15", { smallestUnit: "year", roundingMode: "floor" }); // "+275760-01-01"
roundDate("+275760-06-15", { smallestUnit: "year", roundingMode: "ceil" }); // "" — +275761-01-01 is out of range
getWeekOfMonth("-271821-04-30", "en-US"); // 5
intervalCountZoned("-271821-04-20T00:00:00+00:00[UTC]", "-271821-04-20T01:00:00+00:00[UTC]", "week"); // 1
bucketRange("+275760-09-12T23:00:00Z", "+275760-09-13T00:00:00Z", "day", "America/New_York"); // ["+275760-09-12T04:00:00Z"]
```

**Equal pieces are equal.** The `intervalDivideEqually*` functions computed boundaries in floating point, so pieces differed by nanoseconds and the last one could end up to 66 microseconds past the range. Boundaries are now exact integer division of the span in nanoseconds, rounded half up.

```typescript
import { intervalDivideEquallyUtc } from "@northguild/gmt/utc";

intervalDivideEquallyUtc("2024-01-01T00:00:00Z", "2024-01-01T00:00:01Z", 3).map((piece) => piece.end);
// ["2024-01-01T00:00:00.333333333Z", "2024-01-01T00:00:00.666666667Z", "2024-01-01T00:00:01Z"]
```

**`formatDuration` shows sub-second parts exactly.** It rounded milliseconds, microseconds and nanoseconds to three digits of a second. A duration of one nanosecond printed as `"0 seconds"`, and seconds past 2^53 printed a larger number than the input.

```typescript
import { formatDuration, parseDuration } from "@northguild/gmt/duration";

formatDuration("PT0.000000001S", "en-US"); // "0.000000001 seconds"
formatDuration("PT1.123456789S", "en-US"); // "1.123456789 seconds"
```

Compatibility: round the duration to milliseconds first to keep three digits.

```typescript
formatDuration(parseDuration("PT1.123456789S", { smallestUnit: "millisecond" }), "en-US"); // "1.123 seconds"
```

**Large month spans in non-ISO calendars no longer crash the process.** The polyfill adds and counts non-ISO months one at a time and caches every step. A few million months, which is in range, ran the heap out of memory and aborted the process, and no `try` could catch it. GMT now computes spans of 1,200 months or more in whole years from Temporal's own calendar data. This work-around is inactive for smaller spans, and `pnpm compat` reports when a polyfill release makes it unnecessary.

```typescript
import { addDate } from "@northguild/gmt/plain";

addDate("1402-10-25[u-ca=persian]", { months: 3000000 }); // "251402-10-25[u-ca=persian]"
```

**Smaller corrections.**

- `fromFileTime` and `toFileTime` treat a value at or above 2^63 as out of range, as Windows' `FileTimeToSystemTime` does. They used to decode it as a date as far out as the year 60056. Compatibility: `fromNanoseconds((value - 116444736000000000n) * 100n)` decodes the raw unsigned value.
- `businessDaysBetween` returns `0`, not `-0`.
- `intervalFromDurationTime` returns `null` for a duration of 24 hours or more, or a negative duration that wraps past midnight, as its docs said. It used to return a span of the wrong length, such as a zero-length span for `"PT24H"`.

```typescript
import { fromFileTime, fromNanoseconds } from "@northguild/gmt/precision";
import { intervalFromDurationTime } from "@northguild/gmt/plain";

fromFileTime(9223372036854775808n); // ""
fromNanoseconds((18446744073709551615n - 116444736000000000n) * 100n); // "+060056-05-28T05:36:10.9551615Z"
intervalFromDurationTime("10:00:00", "PT24H", "start"); // null
```
