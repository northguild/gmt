---
"@northguild/gmt": patch
---

Tighten input checks for leap seconds, time zone names, calendar annotations and date shapes, so every function accepts the same strings its validator accepts (Story CORE-8).

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

**Single-component IANA names are time zones.** `timeZoneLike`, and so `isValidTimeZone` and every zone argument, required a `/` in any name except `UTC` and `GMT`. It rejected 42 IANA names such as `Japan`, `Zulu` and `EST5EDT`, and `formatUtc` and `formatUnix` rendered those zones as UTC. The pattern now follows Temporal's `TimeZoneIdentifier` grammar and is case-insensitive: an IANA name, or a UTC offset such as `+05:00`, which this release also accepts as a zone. Any other name starting with `+` or `-` is rejected.

```typescript
import { formatUtc, isValidTimeZone } from "@northguild/gmt";

isValidTimeZone("Japan"); // true
isValidTimeZone("utc"); // true
formatUtc("2024-07-15T16:00:00Z", "en-US", { timeZone: "Japan", hour: "numeric", minute: "2-digit" }); // "1:00 AM"
```

Compatibility: to keep the slash rule, also require `timeZone.includes("/")`, or `"UTC"`/`"GMT"`. `toOffsetInstant` now returns the zone in IANA casing on both paths. Earlier releases echoed the argument's casing, so pass an IANA-cased id to get the same string back.

**`isValidZonedRange` checks calendar annotations as the rest of `zoned/` does.** It accepted any `[u-ca=…]` annotation, which the `zoned/` functions behind it then refused. It now accepts `[u-ca=iso8601]` and returns `false` for any other calendar. Calendar ids and calendar-annotated strings themselves are described in this release's RFC 9557 entry.

```typescript
import { isValidZonedRange } from "@northguild/gmt/zoned";

isValidZonedRange({ value1: "2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]", value2: "2024-02-01T00:00:00+00:00[UTC]" }); // false
isValidZonedRange({ value1: "2024-01-01T00:00:00+00:00[UTC][u-ca=iso8601]", value2: "2024-02-01T00:00:00+00:00[UTC]" }); // true
```

Compatibility: to check a range of calendar-annotated zoned strings, validate each value with `isValidCalendarZonedDateTime`.

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
