---
"@northguild/gmt": minor
---

Give every `unix/` function one epoch grammar, one `{ epochUnit }` option and a UTC default time zone (Story CORE-8).

**UTC is the default time zone everywhere in `unix/`.** About twenty functions read an omitted `timeZone` as the host's zone, so the same call gave a different answer on another machine: `addUnix`, `subtractUnix`, `setUnix`, `roundUnix`, `diffUnix`, `diffUnixAsDuration`, `isBetweenUnix`, `startOfUnix`, `endOfUnix`, `startOfQuarterForUnix`, `endOfQuarterForUnix`, `areUnixEqualBy`, the `convertUnixToPlain*` functions, `parseDateFromUnix`, `parseTimeFromUnix`, `parseDayOfWeekFromUnix`, `parseUnitFromUnix` and `parseWeekFromUnix`. They now use UTC, as `formatUnix` and `formatRelativeUnix` already did. Pass `timeZone: "local"` to the formatters, or a zone id to any function, for another zone.

**One epoch grammar.** An epoch is a safe integer, or a string of ASCII digits with an optional leading `-`. Anything else returns the sentinel: `"+1"`, `" 1"`, `"1e3"`, `"1.0"`, `1.5`, `NaN`, a `bigint`, and a value outside Temporal's instant range. Before, some functions took digit strings and others did not, and the validators disagreed with the functions they guard. `isValidUnixSeconds` and `isValidUnixMilliseconds` now accept exactly what the functions accept.

```typescript
import { addUnix, convertUnixToPlainDate, isValidUnixSeconds, parseHourFromUnix, sortUnix } from "@northguild/gmt/unix";

parseHourFromUnix(1700000000000); // "22"
convertUnixToPlainDate(1710460800, { epochUnit: "seconds" }); // "2024-03-15"
addUnix("1700000000000", { days: 1 }); // 1700086400000
addUnix("+1700000000000", { days: 1 }); // null
isValidUnixSeconds("1700000000"); // true
sortUnix(["3", 1, "2"]); // [1, 2, 3]
```

**The converters take `{ epochUnit }`.** `convertUnixToUtc`, `convertUnixToZoned`, `convertUtcToUnix`, `convertZonedToUnix` and `getUnixNow` took the unit as a positional argument, unlike every other `unix/` function. They now take an options object, and `getUnixNow` returns `number | null`. Singular unit names are accepted in `epochUnit` too, as Temporal §13.17 accepts them.

```typescript
import { convertUnixToUtc } from "@northguild/gmt/unix";
import { convertUtcToUnix } from "@northguild/gmt/utc";

convertUnixToUtc(1709164800, { epochUnit: "seconds" }); // "2024-02-29T00:00:00Z"
convertUnixToUtc("1709164800", { epochUnit: "second" }); // "2024-02-29T00:00:00Z"
convertUtcToUnix("2024-02-29T00:00:00Z", { epochUnit: "seconds" }); // 1709164800
```

`getUnixNowUnit` also accepts plural unit names.

**`intervalLengthUnix`, `intervalCountUnix` and `splitIntervalByUnitUnix` take `epochUnit` and `timeZone`** like the other `unix/interval` functions. They read milliseconds and the host's zone only.

```typescript
import { intervalCountUnix, intervalLengthUnix } from "@northguild/gmt/unix";

intervalLengthUnix(0, 172800, "days", { epochUnit: "seconds" }); // 2
intervalCountUnix(0, 86400000, "day", { timeZone: "America/New_York" }); // 2
```

**An unknown time zone is invalid in the `unix/` and `utc/` formatters.** `formatUnix`, `formatCalendarUnix`, `formatRelativeUnix`, `formatUtc`, `formatCalendarUtc` and `formatRelativeUtc` rendered in UTC when the zone did not exist, as if it had been omitted. ECMA-402 throws a `RangeError` for it, so they now return `""`. An omitted zone is still UTC, and `"local"` is the system zone.

```typescript
import { formatUnix } from "@northguild/gmt/unix";

formatUnix(1700000000000, "en-US", { timeZone: "Not/AZone" }); // ""
```

**Nanosecond fields are three digits.** `parseNanosecondFromUnix` and `parseUnitFromUnix(…, "nanosecond")` returned nine digits. Temporal's `nanosecond` field is 0–999, as every other GMT parser and getter writes it.

```typescript
import { parseNanosecondFromUnix } from "@northguild/gmt/unix";

parseNanosecondFromUnix(1700000000123); // "000"
```

### Breaking changes

| Function | 1.15 | 1.16 |
| --- | --- | --- |
| `convertUnixToUtc`, `convertUnixToZoned` | `convertUnixToUtc(v, "seconds")`, `convertUnixToZoned(v, zone, "seconds")` | `convertUnixToUtc(v, { epochUnit: "seconds" })`, `convertUnixToZoned(v, zone, { epochUnit: "seconds" })` |
| `convertUtcToUnix`, `convertZonedToUnix` | `convertUtcToUnix(v, "seconds")` | `convertUtcToUnix(v, { epochUnit: "seconds" })` |
| `getUnixNow` | `getUnixNow("seconds")`, returns `number` | `getUnixNow({ epochUnit: "seconds" })`, returns `number \| null` |
| `convertUnixToPlainDate`, `…DateTime`, `…Time` | `convertUnixToPlainDate(1710460800, "seconds")` silently read milliseconds: `"1970-01-20"` in UTC | `""`; pass `{ epochUnit: "seconds" }` |
| The unix functions listed above, `timeZone` omitted | the host's zone | `"UTC"`; pass `timeZone` for another zone |
| `intervalLengthUnix`, `intervalCountUnix`, `splitIntervalByUnitUnix` | host zone, milliseconds only | `{ epochUnit, timeZone }`, default milliseconds and `"UTC"` |
| `formatUnix`, `formatCalendarUnix`, `formatRelativeUnix`, `formatUtc`, `formatCalendarUtc`, `formatRelativeUtc` with an unknown `timeZone` | rendered in UTC | `""` |
| `parseNanosecondFromUnix(1700000000000)` | `"000000000"` | `"000"` |
| Epoch strings such as `"+1"`, `"1e3"` or `" 1"` | accepted by some functions | the sentinel |

A positional unit passed to the new signatures returns the sentinel rather than a wrong instant: `convertUnixToUtc(1709164800, "seconds" as never)` is `""`.
