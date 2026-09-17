---
"@northguild/gmt": patch
---

Tighten input checks for leap seconds, time zone names, calendar ids and date shapes, so every function accepts the same strings its validator accepts (Story CORE-8).

**Leap seconds are rejected in every spelling.** GMT rejects `:60`, as Temporal does not represent it, but the check matched only an uppercase `T` with extended digits. A lowercase `t`, a space separator or the basic format (`20161231 235960Z`) got through, and every `zoned/` function silently read the second as `:59`. `getTimeZoneOffset` looked up the offset at the clamped instant, and a `relativeTo` string was never checked at all. All of them now return their sentinel, and `isLeapSecond` and the `leapSecond` regex recognise every spelling.

```typescript
import { addZoned, getTimeZoneOffset, isValidZonedDateTime } from "@northguild/gmt/zoned";

isValidZonedDateTime("2016-12-31t23:59:60+00:00[UTC]"); // false
addZoned("2016-12-31 23:59:60+00:00[UTC]", { seconds: 1 }); // ""
getTimeZoneOffset("UTC", "2016-12-31T23:59:60Z"); // ""
```

Compatibility: to read a leap second as `:59` the way earlier releases did, let Temporal clamp it, or pass the `:59` instant yourself.

```typescript
Temporal.ZonedDateTime.from("2016-12-31 23:59:60+00:00[UTC]").toString(); // "2016-12-31T23:59:59+00:00[UTC]"
getTimeZoneOffset("UTC", "2016-12-31T23:59:60Z".replace(":60", ":59")); // "+00:00"
```

The `instantLeapSecond` regex is now anchored. It used to match inside an annotation value, so `isValidInstant`, the `span*` functions and `toOffsetInstant` rejected a valid instant such as `"2024-01-01T00:00:00Z[x=T123460Z]"`.

**Single-component IANA names are time zones.** `timeZoneLike`, and so `isValidTimeZone` and every zone argument, required a `/` in any name except `UTC` and `GMT`. It rejected 42 IANA names such as `Japan`, `Zulu` and `EST5EDT`, and `formatUtc` and `formatUnix` rendered those zones as UTC. The pattern now follows Temporal's `TimeZoneIANAName` grammar and is case-insensitive. A name can no longer start with `+` or `-`.

```typescript
import { formatUtc, isValidTimeZone } from "@northguild/gmt";

isValidTimeZone("Japan"); // true
isValidTimeZone("utc"); // true
formatUtc("2024-07-15T16:00:00Z", "en-US", { timeZone: "Japan", hour: "numeric", minute: "2-digit" }); // "1:00 AM"
```

Compatibility: to keep the slash rule, also require `timeZone.includes("/")`, or `"UTC"`/`"GMT"`. `toOffsetInstant` now returns the zone in IANA casing on both paths. Earlier releases echoed the argument's casing, so pass an IANA-cased id to get the same string back.

**Calendar annotations use GMT's ids, and only where GMT reads them.** The calendar-string guards accepted Temporal's ids (`roc`, `gregory`, `iso8601`, `islamic-tbla`, `islamicc`, `ethioaa`), which the functions behind them then read inconsistently. `isValidCalendarDate`, `isValidCalendarZonedDateTime` and the functions that take calendar strings now accept only GMT's `CalendarSystem` ids. `isValidZonedRange` now rejects a `[u-ca=…]` annotation, as the rest of `zoned/` does. In `durationAs`, `compareDurations` and `normalizeDuration`, a `relativeTo` calendar string that is not GMT's calendar date shape returns the sentinel. It used to be read with ISO digits or with calendar digits depending on how it was spelled.

```typescript
import { convertDateToCalendar, durationAs, isValidZonedRange } from "@northguild/gmt";

convertDateToCalendar("0113-10-03[u-ca=roc]", "hebrew"); // ""
convertDateToCalendar("0113-10-03[u-ca=taiwan]", "hebrew"); // "5785-01-01[u-ca=hebrew]"
isValidZonedRange({ value1: "2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]", value2: "2024-02-01T00:00:00+00:00[UTC]" }); // false
durationAs("P1M", "days", { relativeTo: "2024-02-10[!u-ca=hebrew]" }); // null
```

Compatibility: use the GMT id, which reads the same date: `taiwan` for `roc`, `gregorian` for `gregory` or `iso8601`, `islamic-tabular` for `islamic-tbla`, `islamic-civil` for `islamicc`, and `ethiopic-amete-alem` for `ethioaa`. For `isValidZonedRange`, remove the annotation first with `value.replace(/\[!?u-ca=[^\]]*\]/g, "")`. For `relativeTo`, convert the ISO date with `convertDateToCalendar`, or pass a Temporal object.

**`isLeapYear` and `getWeekNumber` validate before they parse.** They read date-times, zoned strings and other shapes loosely as a date. They now take a `PlainDate` only.

```typescript
import { getWeekNumber, isLeapYear } from "@northguild/gmt/plain";

isLeapYear("2024-03-15T10:00"); // false
getWeekNumber("2024-03-15T10:00"); // null
getWeekNumber("2024-03-15T10:00".slice(0, 10)); // 11
```

Compatibility: pass the date part alone, or use `Temporal.PlainDate.from(value).inLeapYear` and `.weekOfYear`.

**Regexes.** `year`, `plainDate`, `plainDateTime`, `sqlDateTime` and `utcDateTime` accepted the year `-000000`, which Temporal's grammar forbids. They now reject it.

```typescript
import { year } from "@northguild/gmt/regex";

year.test("-000000"); // false
```
