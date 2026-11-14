---
"@northguild/gmt": patch
---

Every function now accepts exactly one pattern for each kind of string, over the whole string. Before, plain, UTC and instant functions read any time zone annotation and ignored the rest, so `isValidDateTime("2024-02-29T12:34:56[Europe/Helsinkiddddd]")` returned `true`.

- Plain dates, times and date-times (`PlainDate`, `PlainTime`, `PlainDateTime`, `PlainYearMonth`, `PlainMonthDay`) take no annotation of any kind.
- A UTC string is exactly `<date>T<time>Z`. `isValidUtc("2024-01-01T00:00:00Z[u-ca=hebrew]")` is now `false`.
- An instant is `Z` or an offset (`±HH:MM[:SS[.fraction]]`) with nothing after it. A string with a zone bracket, a calendar annotation or any other annotation returns the function's usual empty result (`""`, `null`, `0n` or `false`). To read a zoned string, use a function that keeps the zone: `transitTime`, `nextDeparture`, `scheduleDelivery`, `toOffsetInstant`, and the `zoned/` functions. The `cutoff` argument of `isPastCutoff` and `timeToCutoff` is the zoned string `cutoffAt` returns (`<date>T<time>±HH:MM[Zone]`) and nothing else: a bare `Z` or offset cut-off returns `false` or `""`, and `now` stays an instant.
- The calendar-aware functions (`isValidCalendarDate`, `isValidCalendarZonedDateTime`, `isValidCalendarZonedInterval`, `isValidDateInterval` and the functions built on them) take the body plus at most one `u-ca` annotation. An elective annotation such as `[foo=bar]` is rejected.
- The `zoned/` functions take the zoned body and the zone bracket only. `[foo=bar]`, `[!foo=bar]` and `[u-ca=iso8601]` are rejected.
- The `relativeTo` argument of the `duration/` functions is an ISO 8601 string only, in the plain or the zoned form exactly as above. A `Temporal` object or a property bag (`{ year: 2024, month: 2, day: 30 }`, which Temporal clamps to 29 February) returns the function's empty result, and the `DurationRelativeTo` type is now `string`.
- `hasSecond60` is true only when the whole string is one of GMT's own kinds with a second of `60`: a plain time, a plain date-time, a UTC or offset instant, a zoned date-time or a calendar-aware date-time. A lower-case `t`, a space separator, basic format, a time with a leading `T` or an offset, `[foo=bar]` and trailing text are now `false`. The old uppercase-T pattern in its JSDoc is gone.
- `formatEdifactOffsetDateTime` takes an instant string only (`Z` or an offset). A zone bracket returns `""`; it used to be read, and it set the clock the digits were written on.
- `toOffsetInstant` and `dwellTime` read an instant string with one exact pattern and a zoned string with another, and nothing else.
- A time zone annotation on a zoned string may be an offset (`[+02:00]`), so `isPastCutoff` and `timeToCutoff` accept the cut-off `cutoffAt` writes for an offset `timeZone`.
- A `locale` argument that is not `undefined`, a string or an array of strings returns the function's empty result (`""` or `[]`). A number, `true`, an object or a `String` object used to reach `Intl`, which coerced some of them.
- An unknown `style` for the month, era and weekday name functions returns `[]` instead of the long names.
- A duration designator must be upper case: `P1d` and `Pt1H` return the function's empty result in every duration function, as ISO 8601-1 writes them. The decimal comma stays (`PT0,5H`).
- A time zone annotation is an IANA zone name or an extended offset (`[+02:00]`, `[!Europe/London]`). `[ junk ]`, `[a[b]`, `[+0200]`, `[+02]` and `[+24:00]` return the function's empty result, and `isValidZonedDateTime` and `hasSecond60` return `false`. A bare `isValidTimeZone("+0200")` is unchanged.
- An option the types declare as a string (`roundingMode`, `overflow`, `style`, `dateStyle`, `timeZone`, ...), a boolean (`allowEqual`, `round`, `inclusive`, `inclusiveStart`, `inclusiveEnd`, `includeTimeZoneName`, `zero`, `hour12`) or a number (`roundingIncrement`, `fractionalSecondDigits`) is read only as that type. `new String("floor")`, `"yes"`, `1` or `null` returns the function's empty result (`""`, `[]`, `null` or `false`) and no `toString` or `valueOf` runs. Before, they were converted.
- Every entry of a `locale` array must be a string. `["en-GB", 5]` returns the empty result.
- `punctualityRate` and `cutoffSchedule` take an instant string only; `nextDeparture` and `dwellTime` take an instant or a zoned string that carries its offset. A calendar annotation is rejected.
- `parseHL7`, `isValidHL7` and `hasSecond60` read an HL7 `TS` value as one exact pattern, including its optional extra components (`^` separated).

An instant reader no longer reads a minute-rounded offset against the bracketed zone (`-00:45[Africa/Monrovia]`), because it takes no bracket. Write the offset the instant has (`-00:44:30`), or read the string with a zoned function.
