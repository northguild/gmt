---
"@northguild/gmt": minor
---

Read options, unit names and locales the way Temporal and ECMA-402 read them, and remove the options no function reads (Story CORE-8).

**Singular and plural unit names are the same unit everywhere.** Temporal §13.17 `GetTemporalUnitValuedOption` accepts `"day"` and `"days"` alike. Many GMT functions accepted only one spelling. Every unit-taking function now accepts both: the `startOf*`, `endOf*` and `are*EqualBy` functions, `diffDate`, `diffDateTime`, `diffTime`, `diffUtc`, `diffZoned`, `diffUnix` and their `*AsDuration` forms, the `getLargest*DurationUnit` functions, the `parseUnitFrom*` functions, `durationAs`, `getDurationUnit`, `getZonedOffsetAs`, `spanWallClock`, `floorToZone`, `bucketRange`, `isValidZoneBucketUnit` and the `get*NowUnit` functions.

```typescript
import { diffDate, startOfDate } from "@northguild/gmt/plain";
import { diffZoned } from "@northguild/gmt/zoned";

diffDate("2024-01-01", "2024-03-20", "day"); // 79
diffZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-03-20T00:00:00+00:00[UTC]", "day"); // 79
startOfDate("2024-03-15", "months"); // "2024-03-01"
```

**An options argument must be an object.** Temporal's `GetOptionsObject` throws a `TypeError` for `null`, a string, a number or a boolean. GMT read all of them as "no options". The functions that take their own options object now return their sentinel, and the six `isValid*Range` validators return `false` for such a `props.options`. The functions backed by `Intl.DateTimeFormat` (`formatDate`, `formatTime`, `formatDateTime`, `formatDateRange`, `formatDateTimeRange`, the `…ToParts` functions, `formatUtc`, `formatUnix`, `formatZonedDateTime`, `formatZonedRange` and `formatZonedToParts`) follow ECMA-402's `CoerceOptionsToObject` instead: `null` returns the sentinel, and a string or number means the defaults. The `plain/` formatters and `formatZonedDateTime` already returned `""` for `null`; `formatUtc`, `formatUnix`, `formatZonedRange` and `formatZonedToParts` read it as no options. `formatDuration` builds its own options, so it returns `""` for any non-object.

```typescript
import { addDate } from "@northguild/gmt/plain";
import { durationAs, formatDuration } from "@northguild/gmt/duration";
import { formatUnix } from "@northguild/gmt/unix";

addDate("2024-03-10", { days: 5 }, null); // ""
durationAs("P1DT2H30M", "hours", null); // null
formatUnix(0, "en-US", null); // ""
formatDuration("PT1H", "en-US", null); // ""
```

**An explicit `undefined` is the same as an omitted argument,** as Temporal's `GetOption` treats it. `mapDatesInRange`, `mapZonedDatesInRange`, `fromNanoseconds` and `fromNtpTimestamp` returned their sentinel for it.

```typescript
import { mapDatesInRange } from "@northguild/gmt/plain";

mapDatesInRange("2024-01-01", "2024-01-03", undefined); // ["2024-01-01", "2024-01-02", "2024-01-03"]
```

**Locales follow ECMA-402's `CanonicalizeLocaleList`.** Every locale-taking function accepts a `string` or a `string[]`, and a list uses its first supported tag. `isThisUnit` and `isZonedThisUnit` validate the locale for every unit, not only `"week"`. `getLocaleEraNames`, `getLocaleMeridiems`, `getLocaleMonthNames` and `getLocaleWeekdayNames` used to return `[]` for any list, even `["en-US"]`; a list now works. The 17 functions whose locale is required still return their sentinel for an empty list, rather than reading the host's locale: `getLocaleStartOfWeek`, `getLocaleEndOfWeek`, `getLocaleDayOfWeek`, `getLocaleWeekYear`, `getWeeksInLocaleWeekYear`, `getWeekOfMonth`, `getWeeksInMonth`, `isWeekend`, `getLocaleEraNames`, `getLocaleMeridiems`, `getLocaleMonthNames`, `getLocaleWeekdayNames`, `getLocaleZonedDayOfWeek`, `getLocaleZonedStartOfWeek`, `getLocaleZonedEndOfWeek`, `isZonedWeekend` and `formatTimeZoneName`.

```typescript
import { formatDate, getLocaleStartOfWeek, isThisUnit } from "@northguild/gmt/plain";

formatDate("2024-02-29", ["fr-FR", "en-US"]); // "29/02/2024"
getLocaleStartOfWeek("2024-02-29", ["en-US", "fr-FR"]); // "2024-02-25"
getLocaleStartOfWeek("2024-02-29", []); // ""
isThisUnit("2024-03-15", "day", "en_US"); // false
```

**An invalid `weekStartsOn` is invalid input.** The `startOf*`, `endOf*`, `are*EqualBy`, `parseUnitFrom*` and `parseWeekFrom*` functions and `getWeekNumber` return their sentinel for anything but `"monday"` or `"sunday"`, such as `"Monday"` or `1`.

```typescript
import { areDatesEqualBy, startOfDate } from "@northguild/gmt/plain";

startOfDate("2024-03-15", "week", { weekStartsOn: "Monday" as never }); // ""
areDatesEqualBy("2024-03-15", "2024-03-15", "week", { weekStartsOn: 1 as never }); // false
```

**`setZoned`, `setUnix` and `cycleZoned` default `offset` to `"prefer"`,** as `Temporal.ZonedDateTime#with` does. The default was `"ignore"`, which re-resolved a time in a repeated hour to its first occurrence, so setting the minute of the second 1:30 a.m. moved the value an hour back.

```typescript
import { cycleZoned, setZoned } from "@northguild/gmt/zoned";

setZoned("2024-11-03T01:30:00-05:00[America/New_York]", { minute: 45 }); // "2024-11-03T01:45:00-05:00[America/New_York]"
cycleZoned("2024-11-03T01:30:00-05:00[America/New_York]", "minute", 15); // "2024-11-03T01:45:00-05:00[America/New_York]"
```

**`formatRelativeUtc`, `formatRelativeUnix`, `formatRelativeZoned` and `formatRelativeDateTime` pick units up to a year,** with the thresholds `formatRelativeDate` uses: a week from 7 days, a month from 28 and a year from 365. They stopped at days. `formatRelativeTime` is unchanged, since a time distance is under a day.

```typescript
import { formatRelativeDateTime } from "@northguild/gmt/plain";
import { formatRelativeUtc } from "@northguild/gmt/utc";
import { formatRelativeZoned } from "@northguild/gmt/zoned";

formatRelativeUtc("2026-01-15T14:30:45Z", "en-US", { reference: "2026-04-15T14:30:45Z" }); // "3 months ago"
formatRelativeZoned("2021-01-01T00:00:00+00:00[UTC]", "en-US", { reference: "2024-01-01T00:00:00+00:00[UTC]" }); // "3 years ago"
formatRelativeDateTime("2024-01-01T00:00:00", "en-US", { reference: "2024-01-11T00:00:00" }); // "last week"
```

**`formatRelativeZoned` and `formatCalendarZoned` validate `reference`.** It must be omitted, a zoned or UTC string, or a finite epoch in milliseconds. `true`, `null` or an array was converted to a number and rendered.

**`closestDateTo`, `closestZonedTo` and the `getLargest*DurationUnit` functions return `""` for invalid input.** `closestDateTo` and `closestZonedTo` returned `null`, unlike every other string-returning function. `getLargestDateDurationUnit`, `getLargestDateTimeDurationUnit` and `getLargestTimeDurationUnit` returned their default unit, so an invalid list looked like a real answer.

```typescript
import { closestDateTo, getLargestDateDurationUnit } from "@northguild/gmt/plain";

closestDateTo("nope", ["2024-01-01"]); // ""
getLargestDateDurationUnit(["hours"] as never); // ""
getLargestDateDurationUnit(["day", "month"]); // "months"
```

**`parseDateFromUtc` and the other `parse*FromUtc` functions take a `timeZone`,** as `parseTimeFromUtc` already did. Omitted, they read UTC fields as before.

```typescript
import { parseDateFromUtc, parseHourFromUtc } from "@northguild/gmt/utc";

parseHourFromUtc("2024-03-15T14:30:00Z", { timeZone: "Asia/Tokyo" }); // "23"
parseDateFromUtc("2024-03-15T20:30:00Z", { timeZone: "Asia/Tokyo" }); // "2024-03-16"
```

**`startOfTime` floors below a second.** `startOfTime("12:34:56.999", "millisecond")` returned `"12:34:56.000"`. It now returns `"12:34:56.999"`.

**Options that no function read are removed.** Each was accepted and had no effect on the output, so the only change is that a call passing one stops type-checking.

- `offset` on `addZoned`, `subtractZoned`, `intervalFromDurationZoned` and `convertPlainDateTimeToZoned`. Construction from a date-time and exact-time arithmetic have no offset to reconcile.
- `offset` and `disambiguation` on `setUtc`. UTC has no repeated or skipped wall-clock time.
- `overflow` on `addTime`, `subtractTime`, `intervalFromDurationTime` and `cycleTime`. `Temporal.PlainTime#add` takes no options, since a time has no month to overflow. `addTime`, `subtractTime` and `intervalFromDurationTime` therefore take no options argument at all, and `cycleTime` keeps `{ round }`.

### Breaking changes

| Function | 1.15 | 1.16 |
| --- | --- | --- |
| Functions with their own options object | `addDate(v, d, null)` meant no options | `""`, `null`, `false` or `[]`; omit the argument or pass `{}` |
| `formatUtc`, `formatUnix`, `formatZonedRange`, `formatZonedToParts` | `options = null` meant no options | the sentinel; a string or number still means the defaults |
| `formatDuration(v, locale, "x")` | the defaults | `""` |
| `formatRelativeZoned`, `formatCalendarZoned` with `reference: true` | rendered against epoch 1 | `""` |
| `isThisUnit`, `isZonedThisUnit` | locale read only for `"week"` | an invalid locale returns `false` for every unit |
| `weekStartsOn` other than `"monday"` or `"sunday"` | not checked | the sentinel |
| `setZoned`, `setUnix`, `cycleZoned`, `offset` omitted | `"ignore"`: `setZoned("2024-11-03T01:30:00-05:00[America/New_York]", { minute: 45 })` gave `"…01:45:00-04:00[…]"` | `"prefer"`: `"…01:45:00-05:00[…]"`; pass `{ offset: "ignore" }` for the old result |
| `formatRelativeUtc`, `formatRelativeUnix`, `formatRelativeZoned`, `formatRelativeDateTime` | `"90 days ago"`, `"1,095 days ago"` | `"3 months ago"`, `"3 years ago"`; pass `largestUnit: "day"` for the old text |
| `closestDateTo`, `closestZonedTo` on invalid input | `null` | `""` |
| `getLargestDateDurationUnit` and siblings on invalid input | the default unit | `""` |
| `startOfTime("12:34:56.999", "millisecond")` | `"12:34:56.000"` | `"12:34:56.999"` |
| `addZoned(v, d, { disambiguation, offset })`, likewise `subtractZoned`, `intervalFromDurationZoned`, `convertPlainDateTimeToZoned` | `offset` accepted, no effect | `addZoned(v, d, { disambiguation })` |
| `setUtc(v, fields, { overflow, disambiguation, offset })` | accepted, no effect | `setUtc(v, fields, { overflow })` |
| `addTime(v, d, { overflow })`, `subtractTime(v, d, { overflow })` | accepted, no effect | `addTime(v, d)`, `subtractTime(v, d)` |
| `intervalFromDurationTime(v, duration, anchor, { overflow })` | accepted, no effect | `intervalFromDurationTime(v, duration, anchor)` |
| `cycleTime(v, field, amount, { round, overflow })` | `overflow` accepted, no effect | `cycleTime(v, field, amount, { round })` |
