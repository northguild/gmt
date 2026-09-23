---
"@northguild/gmt": minor
---

Validate `unix/` epoch arguments and read rounding and comparison options the way Temporal reads them (Story CORE-8).

**`epochUnit` is validated.** Fourteen `unix/` functions read any `epochUnit` they did not recognise, including a misspelling, as milliseconds. They are `addUnix`, `subtractUnix`, `diffUnix`, `diffUnixAsDuration`, `isBetweenUnix`, `roundUnix`, `setUnix`, `areUnixEqual`, `isAfterUnix`, `isBeforeUnix`, `intervalFromDurationUnix`, `intervalOverlappingDaysUnix`, `formatCalendarUnix` and `formatRelativeUnix`. They now return their sentinel.

**A blank epoch string is not 1970.** `parseYearFromUnix` and the other `parse*FromUnix` functions read `""` and whitespace as epoch 0. They now return `""`.

**`sortUnix`, `minUnix` and `maxUnix` skip values that are not instants.** A fraction such as `1.5`, or a number past Temporal's range such as `1e20`, was sorted or returned as if it were an epoch.

```typescript
import { addUnix, parseYearFromUnix, sortUnix } from "@northguild/gmt/unix";

addUnix(1700000000000, { days: 1 }, { epochUnit: "minutes" }); // null
parseYearFromUnix("   "); // ""
sortUnix([3, 1.5, 1e20, 2]); // [2, 3]
```

`FormatCalendarUnixOptions` no longer declares `style`, `numeric`, `largestUnit` or `roundingMethod`. `formatCalendarUnix` never read them, so its output is unchanged; see **Breaking changes** below.

**Rounding options follow Temporal.**

- `roundTime`, `roundDateTime`, `roundUtc`, `roundZoned` and `roundUnix` accept plural unit names in `smallestUnit`, as Temporal §13.17 does.
- `roundDate` and `roundDateTime` returned the floor for a `roundingMode` outside Temporal's nine modes. They now return `""`. A fractional `roundingIncrement` is truncated to an integer, as Temporal truncates it, instead of rejected.
- `startOfDate(value, "day")` returns the date, as `endOfDate(value, "day")` already did. It returned `""`.

```typescript
import { roundDate, roundTime, startOfDate } from "@northguild/gmt/plain";

roundTime("12:34:56", { smallestUnit: "hours" }); // "13:00:00"
roundDate("2024-05-20", { smallestUnit: "month", roundingIncrement: 1.5 }); // "2024-06-01"
roundDate("2024-05-20", { smallestUnit: "month", roundingMode: "bogus" as never }); // ""
startOfDate("2024-02-29", "day"); // "2024-02-29"
```

**`areUtcEqualBy` and `areDateTimesEqualBy` compare the buckets you name.** With `fractionalSecondDigits`, they compared the printed strings, so two different milliseconds printed with 0 digits looked equal. They now compare the start of each `unit` bucket, and the option is removed.

```typescript
import { areUtcEqualBy } from "@northguild/gmt/utc";

areUtcEqualBy("2024-05-15T10:20:30.123Z", "2024-05-15T10:20:30.999Z", "millisecond"); // false
```

To compare at the precision the digits stood for, pass that coarser unit.

```typescript
areUtcEqualBy("2024-05-15T10:20:30.123Z", "2024-05-15T10:20:30.999Z", "second"); // true
```

**`getLocaleZonedEndOfWeek` prints the end to the nanosecond.** It kept the whole-second default that the other `endOf*` functions dropped in this release.

```typescript
import { getLocaleZonedEndOfWeek } from "@northguild/gmt/zoned";

getLocaleZonedEndOfWeek("2024-03-13T10:00:00-04:00[America/New_York]", "en-US"); // "2024-03-16T23:59:59.999999999-04:00[America/New_York]"
```

Compatibility: pass `{ fractionalSecondDigits: 0 }` to keep the whole-second string.

```typescript
getLocaleZonedEndOfWeek("2024-03-13T10:00:00-04:00[America/New_York]", "en-US", { fractionalSecondDigits: 0 }); // "2024-03-16T23:59:59-04:00[America/New_York]"
```

### Breaking changes

| 1.15 | 1.16 |
| --- | --- |
| `formatCalendarUnix(v, locale, { reference, style, numeric, largestUnit, roundingMethod })` | `formatCalendarUnix(v, locale, { reference })`: the four members had no effect |
| `areUtcEqualBy(a, b, "millisecond", { fractionalSecondDigits: 0 })` | `areUtcEqualBy(a, b, "second")` |
| `areDateTimesEqualBy(a, b, "millisecond", { fractionalSecondDigits: 0 })` | `areDateTimesEqualBy(a, b, "second")` |
