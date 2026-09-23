---
"@northguild/gmt": minor
---

Read annotations, time zone ids, SQL literals and leap seconds by their standards, and accept only the written shape each validator documents (Story CORE-8).

**Elective annotations are accepted everywhere a Temporal string is.** RFC 9557 §3.3 lets a receiver ignore an elective `[key=value]` annotation and requires it to reject an unknown critical `[!key=value]` one, and Temporal's ISO grammar does exactly that. GMT refused every annotation in some namespaces and read them loosely in others. Now:

- `plain/` validators and functions read elective annotations and a time zone annotation as `Temporal.PlainDate.from` and its siblings do, and accept `[u-ca=iso8601]`. A non-ISO calendar is still refused outside the calendar functions.
- `utc/`, `instant/`, `interval/`, `span/` and `precision/` read an instant as `Temporal.Instant.from` does, which ignores any calendar annotation, critical or not.
- `zoned/` functions accept elective annotations and `[u-ca=iso8601]`, and refuse a non-ISO calendar outside the calendar functions.
- Every namespace rejects an unknown critical annotation.

`isValidZonedRange`, the `plain/` interval validators and `toOffsetInstant` follow the same rule. `getWeekNumber` accepts an ISO-annotated date.

```typescript
import { isValidDateTime, getWeekNumber } from "@northguild/gmt/plain";
import { isValidInterval } from "@northguild/gmt/interval";
import { toOffsetInstant } from "@northguild/gmt/instant";
import { isValidUtc } from "@northguild/gmt/utc";
import { isValidZonedDateTime } from "@northguild/gmt/zoned";

isValidDateTime("2024-01-01T10:00:00[foo=bar]"); // true
isValidDateTime("2024-01-01T10:00:00[!foo=bar]"); // false
isValidUtc("2024-01-01T00:00:00Z[u-ca=hebrew]"); // true
isValidZonedDateTime("2024-01-01T00:00:00+01:00[Europe/Paris][u-ca=iso8601]"); // true
isValidZonedDateTime("2024-01-01T00:00:00+01:00[Europe/Paris][u-ca=hebrew]"); // false
isValidInterval({ start: "2024-01-01T09:00:00Z[u-ca=hebrew]", end: "2024-01-01T17:00:00Z" }); // true
toOffsetInstant("2024-07-15T12:00:00-04:00[foo=bar]"); // { instant: "2024-07-15T16:00:00Z", offset: "-04:00" }
getWeekNumber("2024-06-15[u-ca=iso8601]"); // 24
```

**Each validator accepts only its documented written shape.** Temporal's parser also reads the basic format, a space or lower-case `t` separator, a lower-case `z`, an hour without minutes, and a date with only a zone annotation. `isValidZonedDateTime`, `isValidZonedRange`, `isValidInstant`, `isValidUtc`, `toNanoseconds`, `isValidSpan`, `toOffsetInstant`, `getTimeZoneOffset`, the `utcDateTime` and `calendarZonedDateTime` regexes and a zoned `relativeTo` accepted some of these although GMT never writes them. They now accept only the extended form with an upper-case `T` and `Z`, as the rest of GMT does.

```typescript
import { durationAs } from "@northguild/gmt/duration";
import { isValidInstant } from "@northguild/gmt/precision";
import { isValidZonedDateTime } from "@northguild/gmt/zoned";

isValidZonedDateTime("2024-01-01 00:00:00+01:00[Europe/Paris]"); // false
isValidInstant("20240101T000000Z"); // false
isValidInstant("2024-01-01T00:00:00z"); // false
durationAs("P1D", "hours", { relativeTo: "2024-03-10[America/New_York]" }); // null
durationAs("P1D", "hours", { relativeTo: "2024-03-10T00:00:00-05:00[America/New_York]" }); // 23
```

**UTC offset ids are time zones.** Temporal's `TimeZoneIdentifier` is an IANA name or a UTC offset without seconds. `isValidTimeZone` and every zone argument rejected `"+05:00"`. They now accept it, and `toOffsetInstant` returns the pair without a `timeZone` for an offset zone, because an offset names no zone.

```typescript
import { toOffsetInstant } from "@northguild/gmt/instant";
import { convertUtcToZoned } from "@northguild/gmt/utc";
import { isValidTimeZone } from "@northguild/gmt/zoned";

isValidTimeZone("+05:00"); // true
isValidTimeZone("+05:00:30"); // false
convertUtcToZoned("2024-07-15T16:00:00Z", "+05:00"); // "2024-07-15T21:00:00+05:00[+05:00]"
toOffsetInstant("2024-07-15T16:00:00Z", "+05:00"); // { instant: "2024-07-15T16:00:00Z", offset: "+05:00" }
```

`toOffsetInstant` still writes a zero offset as `+00:00`, never `Z`, because EPCIS `eventTimeZoneOffset` requires `±HH:MM`. Its documentation now says so.

**SQL date-times follow the SQL literal grammar.** SQL-92 §5.3 requires seconds in a timestamp literal, and a four-digit year from 0001 to 9999. The `sqlDateTime` regex and `parseSql` accepted a value without seconds and years outside that range, and `formatSql` wrote years outside it. They now take `YYYY-MM-DD HH:MM:SS`, with an optional `.` and up to nine fraction digits, and `formatSql` returns `""` for a year it cannot write.

```typescript
import { formatSql, parseSql } from "@northguild/gmt/plain";
import { sqlDateTime } from "@northguild/gmt/regex";

sqlDateTime.test("2024-03-15 14:30"); // false
parseSql("2024-03-15 14:30:00.123456789"); // "2024-03-15T14:30:00.123456789"
parseSql("0000-03-15 14:30:00"); // ""
formatSql("+010000-01-01T00:00:00"); // ""
```

**`isLeapSecond` recognises a second-60 field in a bare date-time or time.** It stays a syntactic test, since GMT carries no IERS leap-second table, and matched only a second 60 followed by an offset, `Z` or an annotation. The `leapSecond` regex is widened with it. Every validator still rejects second 60.

```typescript
import { isLeapSecond, isValidDateTime } from "@northguild/gmt/plain";

isLeapSecond("2016-12-31T23:59:60"); // true
isLeapSecond("23:59:60"); // true
isValidDateTime("2016-12-31T23:59:60"); // false
```

**Sub-millisecond time ranges are ordered correctly.** `isValidTimeRange` and `isValidTimeInterval` compared times to the millisecond, so an end one nanosecond before the start was accepted. They now compare with `Temporal.PlainTime.compare`.

```typescript
import { isValidTimeInterval } from "@northguild/gmt/plain";

isValidTimeInterval("10:00:00.000000002", "10:00:00.000000001"); // false
```

### Breaking changes

| Input | 1.15 | 1.16 |
| --- | --- | --- |
| `"2024-01-01T10:00:00[foo=bar]"` to a `plain/` function | rejected | accepted, annotation ignored |
| `"2024-01-01T00:00:00Z[u-ca=hebrew]"` to a `utc/` function | rejected | accepted, calendar ignored |
| `[!u-ca=hebrew]` on an instant, for example to `isValidUtc` or `addUtc` | rejected | accepted, calendar ignored |
| `"…[u-ca=iso8601]"` to `plain/` and `zoned/` functions | rejected | accepted |
| `isValidZonedDateTime("2024-01-01 00:00:00+01:00[Europe/Paris]")`, and basic, lower-case `t` and hour-only spellings | `true` | `false` |
| `isValidUtc("2024-01-01T00:00:00z")` | accepted | `false` |
| `durationAs(…, { relativeTo: "2024-03-10[America/New_York]" })` | a value | `null`; pass a full zoned date-time |
| `isValidTimeZone("+05:00")`, and `"+05:00"` as any zone argument | `false`, sentinel | `true`, accepted |
| `sqlDateTime.test("2024-03-15 14:30")`, `parseSql` of the same | matched, parsed | `false`, `""` |
| `formatSql` for a year past 9999 or before 0001 | a string outside the SQL grammar | `""` |
| `isLeapSecond("2016-12-31T23:59:60")` | `false` | `true` |
| `isValidTimeInterval("10:00:00.000000002", "10:00:00.000000001")` | `true` | `false` |

Migration: write strings in GMT's extended form (`T`, `Z`, full `HH:MM:SS`). Pass SQL values with seconds. Check `isValidTimeZone(zone) && !zone.startsWith("+") && !zone.startsWith("-")` where only IANA zones are allowed.
