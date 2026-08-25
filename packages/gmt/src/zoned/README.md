# Zoned API

IANA timezone-aware date and time operations. All functions accept and return ISO 8601 strings with timezone annotations (e.g., `2024-03-17T14:30:45+00:00[America/New_York]`).

## Modules

### calculate

Timezone-aware arithmetic:

- `addZoned`, `addZonedBusinessDays`, `clampZoned`, `closestZonedTo`
- `cycleZoned`
- `diffZoned`, `diffZonedAsDuration`
- `endOfQuarterForZoned`, `endOfZoned`
- `getHoursInZonedDay`
- `getLocaleZonedDayOfWeek`
- `getLocaleZonedEndOfWeek`, `getLocaleZonedStartOfWeek`
- `getQuarterForZoned`
- `maxZoned`, `minZoned`, `roundZoned`, `setZoned`, `sortZoned`
- `startOfQuarterForZoned`, `startOfZoned`
- `subtractZoned`, `subtractZonedBusinessDays`

### chop

Strip timezone components:

- `chopZonedDate`, `chopZonedDateTime`
- `chopZonedMilliseconds`, `chopZonedSeconds`
- `chopZonedTime`, `chopZonedTimezone`

### compare

Timezone-aware comparison:

- `areZonedEqual`, `areZonedEqualBy`, `isAfterZoned`, `isBeforeZoned`, `isBetweenZoned`, `isZonedBusinessDay`, `isZonedWeekend`
- `isZonedFuture`, `isZonedPast`
- `isZonedRelativeDay`, `isZonedThisUnit`
- `isInDaylightSaving`

### convert

Timezone/format conversion:

- `convertPlainDateTimeToZoned`
- `convertZonedToPlainDateTime`
- `convertZonedToUnix`, `convertZonedToUtc`, `convertZonedToZoned`

### format

Locale-aware timezone formatting:

- `formatZonedDateTime`, `formatZonedRange`
- `formatCalendarZoned` — relative day label + time-of-day (e.g. `"tomorrow at 2:30 PM"`); zoned counterpart of `plain`'s `formatCalendar`
- `formatZonedToParts` — locale-ordered `{ type, value }` parts, including `timeZoneName` parts; GMT's substitute for a token formatter
- `formatRelativeZoned`
- `formatTimeZoneName`
- `formatRfc2822` — RFC 5322 (RFC 2822) email `Date:` header format
- `formatRfc3339` — strict RFC 3339 (strips the bracketed IANA zone annotation GMT's own zoned strings carry, which is not valid RFC 3339)

> `formatRfc2822`/`formatRfc3339` are **fixed grammars**, not display formats — RFC 5322 mandates English weekday/month abbreviations regardless of locale, so neither takes a `locale` argument. See each function's JSDoc.
>
> **Locale data note.** These formatters delegate locale rendering to the host runtime's `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat`. Output therefore depends on the ICU data shipped with the running Node (or browser):
>
> - **Full ICU** runtimes (official Node binaries from nodejs.org, all modern browsers) return fully localized strings — e.g. `formatZonedDateTime(value, "ko-KR", { dateStyle: "full", timeStyle: "full" })` includes `"오후"` and the long Korean timezone name `"대한민국 표준시"`.
> - **Small/partial ICU** runtimes (some Node builds compiled with `--with-intl=small-icu` or repackaged distributions) fall back to English day periods and shorter timezone names — the same call may return `"PM"` and `"한국 표준시"`, and some long-style timezone names may be replaced by offset strings like `"GMT+9"` or `"GMT+03:00"`.
>
> This is a property of the runtime, not the library. If you need consistent non-English output across all environments, ensure your Node deployments use a full-ICU build, or polyfill `Intl` with a package that bundles locale data.

### get

Current in specific timezone and locale-aware extraction:

- `getSystemTimeZone`, `getTimeZones`
- `getZonedNow`, `getZonedNowUnit`, `getZonedToday`
- `getZonedYear`, `getZonedMonth`, `getZonedDay`, `getZonedDayOfWeek`
- `getZonedHour`, `getZonedMinute`, `getZonedSecond`
- `getZonedMillisecond`, `getZonedMicrosecond`, `getZonedNanosecond`
- `getZonedWeekOfYear`
- `getDstTransitions`
- `getTimeZoneOffset`

### interval

Validate and check zoned intervals:

- `isValidZonedInterval`
- `intervalContainsZoned`
- `intervalUnionZoned`
- `splitIntervalByUnitZoned`
- `intervalCountZoned`
- `intervalLengthZoned`
- `intervalDivideEquallyZoned`
- `intervalSplitAtZoned`
- `mergeIntervalsZoned`
- `intervalXorAllZoned`
- `intervalFromDurationZoned`
- `intervalOverlappingDaysZoned`

### map

Generate multiple timezone values:

- `mapZonedDatesInRange`, `mapZonedHoursInDay`

### parse

Extract timezone components:

- `parseDateFromZoned`, `parseDateTimeFromZoned`
- `parseDayFromZoned`, `parseDayOfWeekFromZoned`
- `parseHourFromZoned`
- `parseMicrosecondFromZoned`, `parseMillisecondFromZoned`
- `parseMinuteFromZoned`
- `parseMonthFromZoned`
- `parseNanosecondFromZoned`, `parseSecondFromZoned`
- `parseTimeFromZoned`, `parseTimeZoneFromZoned`
- `getZonedOffset`, `getZonedOffsetAs`
- `parseUnitFromZoned`
- `parseWeekFromZoned`
- `parseYearFromZoned`
- `parseRfc2822` — decode an RFC 5322 (RFC 2822) email `Date:` header
- `parseRfc3339` — decode a strict RFC 3339 datetime string

### validate

Validation helpers:

- `hasDaylightSaving`, `isValidTimeZone`, `isValidZonedDateTime`, `isValidZonedRange`
- `isValidCalendarZonedDateTime` — accepts GMT's calendar-annotated zoned grammar (see below)

## Calendar-annotated zoned strings (E7, issue #152)

`zoned/` has its own GMT-native calendar-annotated grammar:

```
<calendar-native-date>T<time><offset>[u-ca=<id>[;era=<era>]][<timeZone>]

5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]
0031-04-30T12:00:00+09:00[u-ca=japanese;era=heisei][Asia/Tokyo]
7517-12-30T00:30:00-04:00[u-ca=ethiopic-amete-alem][America/Santiago]
```

Produced by `convertZonedToCalendar`, validated by `isValidCalendarZonedDateTime` /
`isValidCalendarZonedInterval`. A bare ISO zoned string is unaffected and reports `"gregorian"`.

**The `[u-ca=...]` segment precedes `[timeZone]` — the reverse of RFC 9557, deliberately.** GMT's
digits are calendar-native, so the string is never valid RFC 9557 anyway, and `;era=` is not valid
RFC 9557 at any ordering. Writing it in RFC order is the dangerous option:
`Temporal.ZonedDateTime.from("5784-01-01T14:30:00-05:00[America/New_York][u-ca=hebrew]")` succeeds
and silently reads 5784 as an ISO year. GMT's ordering makes that shape uniformly rejected. See
`regex/calendar-zoned-date-time.ts`.

**In scope** (gated on the new validators): `addZoned`, `subtractZoned`, `diffZoned`,
`diffZonedAsDuration`, `convertZonedToCalendar`, and every `zoned/interval/*` function.

**Out of scope, unchanged**: every other `zoned/` function still gates on `isValidZonedDateTime`,
which still rejects all `[u-ca=...]` annotations — including `addZonedBusinessDays` /
`subtractZonedBusinessDays` (day-of-week is ISO-fixed in every supported calendar, so a tag would
change nothing while implying it might). `isValidZonedDateTime` was deliberately NOT loosened: a
validator that certified strings most of the namespace still refuses would be worse than one that
is narrower than the namespace.

Mixed-calendar endpoints: ordering functions accept them (ordering is calendar-independent);
the eight value-returning set operations reject a mismatch; measurement functions measure in the
shared calendar or fall back to Gregorian. See `packages/gmt/README.md`'s "Calendar-aware zoned
datetimes" and `context/roadmap/issues/E.md`'s E5/E7 sections for the full rationale.
