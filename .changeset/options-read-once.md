---
"@northguild/gmt": minor
---

Read each option once per call, convert it once, and read inherited options in every formatter that passes its options to `Intl.DateTimeFormat`.

**One read per option.** 56 functions read an option twice or more: once to check it or to choose its default, and again to use it. An options object whose property is a getter could answer a different value each time, so the value that was checked was not the value that was used. ECMA-402 and the Temporal specification read an option with one `Get` (`GetOption`), and every function that takes an `options` object now does the same.

```typescript
import { getZonedNow } from "@northguild/gmt";

let reads = 0;
const options = {
  get smallestUnit() {
    reads += 1;
    return reads === 1 ? ("minute" as const) : undefined;
  },
};

// With the clock at 2024-02-29T00:00:00Z
getZonedNow("UTC", options); // "2024-02-29T00:00+00:00[UTC]" — was "2024-02-29T00:00:00+00:00[UTC]"
reads; // 1 — was 2
```

**One conversion per option.** `GetOption` also converts the value it read once: to a string, or to a number for `fractionalSecondDigits`. Twelve functions asked an option given as an object for its value twice, once to check it and once to use it, so the object could answer `"long"` to the check and `"narrow"` to the formatter. They now ask once and use that answer throughout.

**Inherited options.** ECMA-402 reads an option with `Get`, which follows the prototype chain, so an option an object inherits is an option. Five functions copied only the options an object holds itself and ignored the rest. They now read each option as `Intl.DateTimeFormat` does.

A plain options object whose values are strings, numbers and booleans gives the same result as before.

### Breaking changes

An inherited option is now read. Each call below passes `Object.create({ dateStyle: "full" })` as `options`.

| Call | 1.17 | 1.18 |
| --- | --- | --- |
| `formatUtc("2024-03-15T20:00:00Z", "en-US", options)` | `"3/15/2024, 8:00:00 PM"` | `"Friday, March 15, 2024"` |
| `formatUnix(1710532800000, "en-US", options)` | `"3/15/2024, 8:00:00 PM"` | `"Friday, March 15, 2024"` |
| `formatZonedDateTime("2024-03-15T20:00:00+00:00[UTC]", "en-US", options)` | `"3/15/2024"` | `"Friday, March 15, 2024"` |
| `formatZonedRange("2024-03-15T20:00:00+00:00[UTC]", "2024-03-17T20:00:00+00:00[UTC]", "en-US", options)` | `"3/15/2024 - 3/17/2024"` | `"Friday, March 15 - Sunday, March 17, 2024"` |
| `formatZonedToParts("2024-03-15T20:00:00+00:00[UTC]", "en-US", options)` | The parts of `"3/15/2024"`: month, day and year | The parts of `"Friday, March 15, 2024"`: weekday, month, day and year |

To keep the 1.17 result, pass an object that does not inherit the option, for example `{}` or `Object.create(null)`. The other seven formatters (`formatDate`, `formatDateRange`, `formatDateTime`, `formatDateTimeRange`, `formatDateToParts`, `formatDateTimeToParts`, `formatTime`) already read inherited options and are unchanged.

An option given as an object is now converted once. In the calls below `month` is an object whose `toString` returns `"long"` the first time and `"narrow"` after that, and `later` is one that returns `"later"` and then `"earlier"`.

| Call | 1.17 | 1.18 |
| --- | --- | --- |
| `formatDate("2024-03-15", "en-US", { month, day: "numeric" })`, likewise `formatDateTime`, `formatUtc` and `formatUnix` for the same day | `"M 15"` | `"March 15"` |
| `formatDateRange("2024-03-15", "2024-03-17", "en-US", { month, day: "numeric" })`, likewise `formatDateTimeRange` | `"M 15 - 17"` | `"March 15 - 17"` |
| `formatDateToParts("2024-03-15", "en-US", { month, day: "numeric" })`, likewise `formatDateTimeToParts` | A month part of `"M"` | A month part of `"March"` |
| `formatTime("20:05:00", "en-US", { hour, minute: "2-digit" })`, where `hour` returns `"2-digit"` and then `"numeric"` | `"8:05 PM"` | `"08:05 PM"` |
| `formatTime("20:05:00", "en-US", { timeStyle: new String("long") })` | `"8:05:00 PM UTC"` | `"8:05:00 PM"` |
| `formatDateTime("2024-03-15T20:05:00", "en-US", { timeStyle: new String("full") })` | `"8:05:00 PM Coordinated Universal Time"` | `"8:05:00 PM"` |
| `addZoned("2024-11-02T01:30:00-04:00[America/New_York]", { days: 1 }, { disambiguation: later })` | `"2024-11-03T01:30:00-04:00[America/New_York]"` | `"2024-11-03T01:30:00-05:00[America/New_York]"` |
| `subtractZoned("2024-11-04T01:30:00-05:00[America/New_York]", { days: 1 }, { disambiguation: later })` | `"2024-11-03T01:30:00-04:00[America/New_York]"` | `"2024-11-03T01:30:00-05:00[America/New_York]"` |
| `intervalFromDurationZoned("2024-11-02T01:30:00-04:00[America/New_York]", "P1D", "start", { disambiguation: later })` | An `end` of `"2024-11-03T01:30:00-04:00[America/New_York]"` | An `end` of `"2024-11-03T01:30:00-05:00[America/New_York]"` |

TypeScript rejects an object where each of these options expects a string, so only untyped callers and casts are affected. Pass the string itself and the result is the same in both versions.
