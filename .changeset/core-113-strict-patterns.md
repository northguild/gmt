---
"@northguild/gmt": minor
---

Every function now accepts exactly one pattern for each kind of string, over the whole string. Before, plain, UTC and instant functions read any time zone annotation and ignored the rest, so `isValidDateTime("2024-02-29T12:34:56[Europe/Helsinkiddddd]")` returned `true`. Some calls that returned a value now return the function's empty result, and the `DurationRelativeTo` type is narrower, so **Breaking changes** lists each change with its migration.

- Plain dates, times and date-times (`PlainDate`, `PlainTime`, `PlainDateTime`, `PlainYearMonth`, `PlainMonthDay`) take no annotation of any kind.
- A UTC string is exactly `<date>T<time>Z`. `isValidUtc("2024-01-01T00:00:00Z[u-ca=hebrew]")` is now `false`.
- An instant is `Z` or an offset (`±HH:MM[:SS[.fraction]]`) with nothing after it. A string with a zone bracket, a calendar annotation or any other annotation returns the function's usual empty result (`""`, `null`, `0n` or `false`). To read a zoned string, use a function that keeps the zone: `transitTime`, `nextDeparture`, `scheduleDelivery`, `toOffsetInstant`, and the `zoned/` functions. The `cutoff` argument of `isPastCutoff` and `timeToCutoff` is the zoned string `cutoffAt` returns (`<date>T<time>±HH:MM[Zone]`) and nothing else: a bare `Z` or offset cut-off returns `false` or `""`, and `now` stays an instant.
- The calendar-aware functions (`isValidCalendarDate`, `isValidCalendarZonedDateTime`, `isValidCalendarZonedInterval`, `isValidDateInterval` and the functions built on them) take the body plus at most one `u-ca` annotation. An elective annotation such as `[foo=bar]` is rejected.
- The `zoned/` functions take the zoned body and the zone bracket only. `[foo=bar]`, `[!foo=bar]` and `[u-ca=iso8601]` are rejected.
- The `relativeTo` argument of the `duration/` functions is an ISO 8601 string only, in the plain or the zoned form exactly as above. A `Temporal` object or a property bag (`{ year: 2024, month: 2, day: 30 }`, which Temporal clamps to 29 February) returns the function's empty result, and the `DurationRelativeTo` type is now `string`.
- `hasSecond60` is true only when the whole string is one of GMT's own kinds with a second of `60`: a plain time, a plain date-time, a UTC or offset instant, a zoned date-time or a calendar-aware date-time. A lower-case `t`, a space separator, basic format, a time with a leading `T` or an offset, `[foo=bar]` and trailing text are now `false`. The date, zone and calendar must also exist, so `2016-02-30T23:59:60` and `2016-12-31T23:59:60+00:00[Not/AZone]` are `false`; the leap-second list is not checked. The old uppercase-T pattern in its JSDoc is gone.
- `formatEdifactOffsetDateTime` takes an instant string only (`Z` or an offset). A zone bracket returns `""`; it used to be read, and it set the clock the digits were written on.
- `toOffsetInstant` and `dwellTime` read an instant string with one exact pattern and a zoned string with another, and nothing else.
- A time zone annotation on a zoned string may be an offset (`[+02:00]`), so `isPastCutoff` and `timeToCutoff` accept the cut-off `cutoffAt` writes for an offset `timeZone`.
- A `locale` argument that is not `undefined`, a string or an array of strings returns the function's empty result (`""` or `[]`). A number, `true`, an object or a `String` object used to reach `Intl`, which coerced some of them.
- An unknown `style` for the month, era and weekday name functions returns `[]` instead of the long names.
- A duration designator must be upper case: `P1d` and `Pt1H` return the function's empty result in every duration function, as ISO 8601-1 writes them. The decimal comma stays (`PT0,5H`).
- A time zone annotation is an IANA zone name or an extended offset (`[+02:00]`, `[!Europe/London]`). `[ junk ]`, `[a[b]`, `[..]`, `[+0200]`, `[+02]` and `[+24:00]` return the function's empty result, and `isValidZonedDateTime` and `hasSecond60` return `false`. A bare `isValidTimeZone("+0200")` is unchanged.
- An option the types declare as a string (`roundingMode`, `overflow`, `style`, `dateStyle`, `timeZone`, ...), a boolean (`allowEqual`, `round`, `inclusive`, `inclusiveStart`, `inclusiveEnd`, `includeTimeZoneName`, `zero`, `hour12`) or a number (`roundingIncrement`, `fractionalSecondDigits`) is read only as that type. `new String("floor")`, `"yes"`, `1` or `null` returns the function's empty result (`""`, `[]`, `null` or `false`) and no `toString` or `valueOf` runs, even when that option plays no part in the call. Before, they were converted.
- Every entry of a `locale` array must be a string. `["en-GB", 5]` returns the empty result.
- `punctualityRate` and `cutoffSchedule` take an instant string only; `nextDeparture` and `dwellTime` take an instant or a zoned string that carries its offset. A calendar annotation is rejected.
- `parseHL7` and `isValidHL7` read an HL7 `TS` value exactly. The first component is the date-time and the second is empty or a degree-of-precision code; anything else inside either one, such as `2024&X`, is rejected. Components after the degree are ignored as HL7 v2 section 2.6.2 says, unless one holds a `|` or `~` or a control character.
- Options that a caller supplies as getters are read once, as their declared type, and only those values reach Temporal and Intl. A getter that returns a `String` object, a number or a different value on the second read now returns the function's empty value instead of being converted.

### Breaking changes

**1. Plain, UTC and instant functions refuse an annotated string.** This covers every function that takes a `PlainDate`, `PlainTime`, `PlainDateTime`, `PlainYearMonth`, `PlainMonthDay`, UTC or instant string, in every namespace. A bracket of any kind after the value (a zone, a calendar, `[foo=bar]`) now gives the function's empty result (`""`, `null`, `0n`, `false` or `[]`).

| Call | 1.21 | 1.22 |
| --- | --- | --- |
| `isValidDateTime("2024-02-29T12:34:56[Europe/Helsinki]")` | `true` | `false` |
| `isValidInstant("2024-06-15T10:30:00+02:00[Europe/Paris]")` | `true` | `false` |
| `toArrowTimestamp("2024-06-15T10:30:00+02:00[Europe/Paris]", "second")` | `1718440200n` | `0n` |
| `diffDate("2024-03-10[Europe/London]", "2024-03-15", "days")` | `5` | `null` |
| `hasSecond60("2016-12-31T23:59:60Z[u-ca=iso8601]")` | `true` | `false` |

Migration: for a zoned string, call a function that keeps the zone (the `zoned/` functions, `transitTime`, `nextDeparture`, `scheduleDelivery`), or turn it into an instant first with `toOffsetInstant(value)?.instant`. For a plain value, drop the bracket.

One instant reads differently. 1.21 read a minute-rounded offset against the zone in the bracket, so `1960-06-01T11:15:30-00:45[Africa/Monrovia]` was the moment `-00:44:30` names. Without the bracket, `-00:45` is read as written, 30 seconds later. `Temporal.Instant#toString({ timeZone })` and `ZonedDateTime#toString` write that rounded offset.

| Call | 1.21 | 1.22 |
| --- | --- | --- |
| `toArrowTimestamp("1960-06-01T11:15:30-00:45[Africa/Monrovia]", "second")` | `-302443200n` | `0n` |
| `toArrowTimestamp("1960-06-01T11:15:30-00:45", "second")` | `-302443170n` | `-302443170n` |
| `toArrowTimestamp("1960-06-01T11:15:30-00:44:30", "second")` | `-302443200n` | `-302443200n` |

Migration: write the offset the zone has at that instant. `toOffsetInstant` returns it to the second, and `fromOffsetInstant` given that `instant` and `offset`, without `timeZone`, writes the local time with it:

```typescript
import { fromOffsetInstant, toOffsetInstant } from "@northguild/gmt";

const read = toOffsetInstant("1960-06-01T11:15:30-00:44:30[Africa/Monrovia]");
if (read !== null) {
  fromOffsetInstant({ instant: read.instant, offset: read.offset }); // "1960-06-01T11:15:30-00:44:30"
}
```

**2. The list functions skip an annotated entry.** `minDate`, `maxDate`, `sortDates`, `closestDateTo`, `minDateTime`, `maxDateTime`, `sortDateTimes`, `minTime`, `maxTime`, `sortTimes`, `minUtc`, `maxUtc`, `sortUtc`, `minZoned`, `maxZoned`, `sortZoned` and `closestZonedTo` drop an entry their kind does not take, as they drop any other invalid entry. 1.21 stripped the annotation and kept it.

| Call | 1.21 | 1.22 |
| --- | --- | --- |
| `maxDate(["2024-03-10", "2024-03-15[u-ca=iso8601]"])` | `"2024-03-15"` | `"2024-03-10"` |
| `sortDates(["2024-03-15[u-ca=iso8601]", "2024-03-10"])` | `["2024-03-10", "2024-03-15"]` | `["2024-03-10"]` |

Migration: drop the bracket from each entry before the call, as for item 1.

**3. A cut-off is the zoned string `cutoffAt` writes.** `isPastCutoff` and `timeToCutoff` read `cutoff` as a zoned string only.

| Call | 1.21 | 1.22 |
| --- | --- | --- |
| `isPastCutoff("2024-06-12T18:00:00Z", "2024-06-12T17:00:00Z")` | `true` | `false` |
| `timeToCutoff("2024-06-12T16:00:00Z", "2024-06-12T17:00:00Z")` | `"PT1H"` | `""` |

Migration: pass the value `cutoffAt` returns, or a cut-off with its zone: `isPastCutoff("2024-06-12T18:00:00Z", "2024-06-12T17:00:00+00:00[UTC]")` is `true`.

**4. `relativeTo` is a string, and `DurationRelativeTo` is `string`.** A `Temporal` object or a property bag passed to a `duration/` function no longer compiles, and returns the empty result at run time.

| Call | 1.21 | 1.22 |
| --- | --- | --- |
| `totalDuration("P1M", "days", { relativeTo: Temporal.PlainDate.from("2024-02-01") })` | `29` | Does not compile. Returns `null` at run time |
| `totalDuration("P1M", "days", { relativeTo: { year: 2024, month: 2, day: 30 } })` | `29` (Temporal clamps the 30th to the 29th) | Does not compile. Returns `null` at run time |

Migration: pass the ISO 8601 string, `{ relativeTo: "2024-02-01" }`, or call `.toString()` on the `Temporal` object.

**5. A duration designator is upper case.** Every `duration/` function, and every function that takes a duration string, refuses `P1d` or `pt36h`.

| Call | 1.21 | 1.22 |
| --- | --- | --- |
| `totalDuration("pt36h", "days")` | `1.5` | `null` |

Migration: write the designators in upper case, `PT36H`.

**6. An option is read only as its declared type.** A `String` object, a number for a string option, `"yes"` for a boolean and any other converted value give the empty result, as listed above, as does a `locale` that is not `undefined`, a string or an array of strings, and an unknown name-width `style`.

Migration: pass a string, boolean or number literal of the declared type.

**7. `parseHL7` and `isValidHL7` read a `TS` exactly.**

| Call | 1.21 | 1.22 |
| --- | --- | --- |
| `parseHL7("2024&X")` | `{ kind: "partial", local: "2024", offset: "", precision: "year" }` | `null` |
| `parseHL7("20240615^D^X\|Y")` | `{ kind: "partial", local: "2024-06-15", offset: "", precision: "day" }` | `null` |

Migration: pass one field, split from the message on its field, repetition and segment delimiters, with no subcomponent in the date-time or the degree.

**8. `hasSecond60` checks the whole string.** A lower-case `t`, a space, basic format, trailing text and a date, zone or calendar that does not exist give `false`.

| Call | 1.21 | 1.22 |
| --- | --- | --- |
| `hasSecond60("2016-12-31t23:59:60Z")` | `true` | `false` |
| `hasSecond60("2016-02-30T23:59:60")` | `true` | `false` |

Migration: write the value in one of GMT's own kinds, with an upper-case `T`.
