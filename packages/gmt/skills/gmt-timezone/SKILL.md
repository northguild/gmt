---
name: gmt-timezone
description: >
  Timezone-aware operations — zoned now, zoned formatting, plain↔zoned↔UTC↔Unix
  conversion, DST disambiguation, toOffsetInstant, classifyLocal/resolveLocal,
  classifyStoredZoned (why a stored offset+zone string no longer resolves), real
  boundaries (startOfZoned/endOfZoned/startOfUnix/endOfUnix), hours in a local
  day, floorToZone/bucketRange, calendar-annotated strings, operating hours
  (OperatingSchedule, recurringWindows, operatingIntervals, isOpenAt,
  nextOpenAt, nextCloseAt, operatingTimeBetween, addOperatingTime), recurrence
  rules and cron lines in a zone (parseRecurrenceRule, expandRecurrence,
  parseCronExpression, cronRuns), and daylight time (isInDaylightSaving,
  hasDaylightSaving). Transport legs, intermodal free
  time and EDI timestamps are in gmt-transport and gmt-intermodal.
sources:
  - 'northguild/gmt:apps/dox/src/content/docs/guides/zoned-date-operations/*.mdx'
  - 'northguild/gmt:apps/dox/src/content/docs/guides/concepts/dst-disambiguation.md'
  - 'northguild/gmt:apps/dox/src/content/docs/guides/core-date-operations/operating-hours.mdx'
  - 'northguild/gmt:packages/gmt/src/zoned/get/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/format/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/compare/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/convert/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/classify/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/calculate/addZoned.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/calculate/startOfZoned.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/calculate/roundZoned.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/calculate/getHoursInZonedDay.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/calculate/clampZoned.ts'
  - 'northguild/gmt:packages/gmt/src/unix/get/index.ts'
  - 'northguild/gmt:packages/gmt/src/utc/get/index.ts'
  - 'northguild/gmt:packages/gmt/src/utc/convert/index.ts'
  - 'northguild/gmt:packages/gmt/src/instant/convert/index.ts'
  - 'northguild/gmt:packages/gmt/src/instant/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/calendar/calculate/index.ts'
  - 'northguild/gmt:packages/gmt/src/calendar/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/calendar/hours/index.ts'
  - 'northguild/gmt:packages/gmt/src/types/operating-schedule.ts'
  - 'northguild/gmt:apps/dox/src/content/docs/guides/zoned-date-operations/recurrence-and-cron.mdx'
  - 'northguild/gmt:packages/gmt/src/recurrence/parse/index.ts'
  - 'northguild/gmt:packages/gmt/src/recurrence/calculate/index.ts'
  - 'northguild/gmt:packages/gmt/src/types/recurrence.ts'
  - 'northguild/gmt:packages/gmt/src/types/cron.ts'
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.20.0'
---

# GMT Timezone

Use this skill when the task requires IANA time zone awareness — formatting,
converting between time zones, or doing arithmetic that must respect DST.

## When to load

- The user needs the current time in a specific timezone (`"Asia/Tokyo"`).
- The user wants to format a datetime with its zone attached.
- The user needs to convert a plain datetime to a zoned instant, or between
  timezones, or between UTC and Unix epochs.
- The user is adding/subtracting durations across a DST transition.
- The user has a timestamp that must keep the local offset it happened at, or a
  local wall time that arrived with no offset at all.
- The user needs the start or end of a local hour, day, week, month or quarter.
- The user is grouping or aggregating UTC timestamps by local day, hour, week or
  month — an observability rollup, a chargeable-days count.
- The user is asking whether a gate, desk, office or venue is open at an
  instant, when it next opens or closes, how many working hours passed between
  two instants, or when an SLA measured in open hours falls due — or is
  expanding a recurring local window such as a night curfew.
- The user has an iCalendar `RRULE` or a cron line (`30 2 * * *`) and needs the
  instants it produces in an IANA zone, including the ones a daylight-saving
  change touches.

## Core rules

1. **Use IANA timezone ids, not raw offsets.** `"2024-03-15T14:30:45[Australia/Sydney]"`
   is correct; bare `"+11:00"` loses the zone and can't observe DST rules.
2. **DST disambiguation.** `convertPlainDateTimeToZoned`, `addZoned` and
   `setZoned` accept `disambiguation` (`"compatible"` | `"earlier"` |
   `"later"` | `"reject"`) for gap/overlap resolution. On `addZoned`,
   `subtractZoned` and `intervalFromDurationZoned` it follows TC39
   AddZonedDateTime: the date part (years to days) moves the wall clock, the
   time part (hours and smaller) is added in exact time, and `disambiguation`
   resolves the wall clock the date part lands on, in a spring-forward gap or
   a fall-back overlap: `"compatible"`/`"later"` move a gap landing forward,
   `"earlier"` back, `"reject"` returns the sentinel. A time-only duration
   ignores it, so `+ { minutes: 10 }` is always 10 real minutes.
3. **Boundaries are always the real zone boundary.** `startOfZoned`,
   `endOfZoned`, `startOfQuarterForZoned`, `endOfQuarterForZoned`,
   `getLocaleZonedStartOfWeek`, `getLocaleZonedEndOfWeek` and their `unix/`
   counterparts (`startOfUnix`,
   `endOfUnix`, …) return the real start and end of the unit that contains the
   input: the start is never after the input, and the end is the last
   nanosecond before the next start, printed at nanosecond precision by default
   (`"…T23:59:59.999999999…"`); pass `fractionalSecondDigits: 0` for the shorter
   pre-1.16.0 string. `Pacific/Chatham`'s 03:00 hour on its
   spring-forward begins at 03:45, and New York's repeated 1 a.m. is its own
   hour. `areZonedEqualBy`/`areUnixEqualBy` compare these boundary instants, so
   the two passes of a repeated hour are not equal. A day whose midnight repeats
   on the same date (America/Havana, 2024-11-03) is one 25-hour day.
   `getHoursInZonedDay` and `mapZonedHoursInDay` measure the input's calendar
   date via TC39 `hoursInDay`; that differs from `startOfZoned(…, "day")` only
   where a fall-back re-enters the previous date (America/Goose_Bay,
   2010-11-07).
4. **Boundary functions take no `disambiguation` or `offset`.** They match
   TC39 `startOfDay()`, which takes no such options. Resolution options belong on
   functions that set wall-clock fields —
   `convertPlainDateTimeToZoned`, `resolveLocal`, `addZoned`, `setZoned`.
5. **Classify a zoneless wall time before resolving it.** `classifyLocal(local,
   zone)` returns `"unique"` | `"ambiguous"` | `"nonexistent"` so code can branch
   rather than accept a policy — 01:30 happens twice on a fall-back day and never
   on a spring-forward one. `resolveLocal(local, zone, { disambiguation })` then
   returns the instant, exact to the nanosecond, or `""` under `"reject"`. Reach
   for `convertPlainDateTimeToZoned` instead when you want the zoned string.
6. **An offset is not a zone, but a stored one is a rule for local time.**
   `toOffsetInstant` gives `{ instant, offset, timeZone? }`, the pair EPCIS 2.0,
   EDIFACT DTM and DICOM exchange. Its `±HH:MM[:SS]` offset is a valid `timeZone`
   for `resolveLocal` and every function whose result has no zone in it. One
   that returns a zoned string or formats with `Intl` takes none with seconds.
   **A stored string can stop agreeing with its zone.**
   `classifyStoredZoned("2016-12-01T09:00:00+02:00[Europe/Istanbul]")` returns
   `kind: "offsetMismatch"` with `storedOffset`, `zoneOffset` and the instant each
   reading gives. The other kinds are `valid`, `validInOverlap`, `ambiguous` and
   `nonexistent`; every one carries `atStoredOffset`, and it returns `null` for a
   string without both an offset and a zone. It picks no reading: your policy
   chooses among those returned. The answer follows the host's time zone rules, so
   the same string can differ between hosts. Import it from
   `@northguild/gmt/zoned/classify`.
7. **Bucket in the zone, not in UTC.** `floorToZone(instant, unit, zone)` and
   `bucketRange(start, end, unit, zone)` floor on the zone's own calendar
   boundaries. Flooring a UTC instant to a UTC day and calling it a local day is
   wrong for most of the world for most of the day. The buckets are deliberately
   not uniform: a day that springs forward is 23 hours and one that falls back is
   25, and forcing 24 is what makes a daily aggregate drift.
   `intervalCountZoned`/`intervalCountUnix`/`intervalCountUtc` count exactly
   the buckets `bucketRange` returns.
8. **`roundZoned`/`roundUnix` are not a floor.** They follow TC39
   `ZonedDateTime.round`, which rounds the wall clock and re-resolves it in the
   zone, so `roundingMode: "trunc"` can land after the input:
   `"2024-09-29T03:50:00+13:45[Pacific/Chatham]"` truncated to the hour gives
   04:00. Never truncate-and-re-resolve (`round` with `"trunc"`, or `.with()`
   on the wall clock) to find a zoned boundary — use `floorToZone` or
   `startOfZoned` with no options.
9. **Hours in a day come from the zone.** `getHoursInZonedDay` is Temporal's
   `hoursInDay`: 23 on a spring-forward day, 25 on a fall-back day, 23.5 in
   `Australia/Lord_Howe`, and 23 on a day whose midnight is skipped
   (`America/Santiago`, 2024-09-08). `mapZonedHoursInDay` stops at the next
   local day.
10. **Calendar annotations.** A calendar-annotated zoned string is RFC 9557,
    `Temporal.ZonedDateTime#toString()`: ISO digits, then `[timeZone]`, then
    `[u-ca=<id>]` (`"2024-10-03T14:30:45+03:00[Asia/Jerusalem][u-ca=hebrew]"`).
    A calendar annotation before the zone is rejected. Only `addZoned`, `subtractZoned`,
    `diffZoned`, `diffZonedAsDuration`, `convertZonedToCalendar`,
    `isValidCalendarZonedDateTime` and `zoned/interval/*` (including
    `isValidCalendarZonedInterval`) accept it; everything else rejects it and
    returns its invalid-input sentinel — `""` for a string result, `null` for a
    number, `[]` for a list, and `false` for a validator or predicate such as
    `isValidZonedDateTime` or `isBeforeZoned`. Always produce these with
    `convertZonedToCalendar`. Calendar ids are the canonical Temporal ids (see
    the `gmt-arithmetic` skill), and `[!u-ca=…]` is accepted wherever
    `[u-ca=…]` is. Differences between values naming different calendars
    return the sentinel for every unit, hours included.
11. **Zoned values are exact at the range limits.** In zones ahead of UTC,
    `isValidZonedDateTime("+275760-09-13T10:00:00+10:00[Australia/Sydney]")`
    is `true` and one nanosecond later is `false`. Parsing, arithmetic,
    boundaries, differences and `relativeTo` totals all work there.
    Daylight-saving rules hold to the end: `America/Santiago`'s
    `+275760-09-07` is a 23-hour day. At the first instant in a zone behind
    UTC, an offset-less wall clock (`"-271821-04-19T12:00:00[Etc/GMT+12]"`)
    resolves. The same string with its `-12:00` offset returns the sentinel,
    because TC39 checks that local date against the day range.
12. **Zoned differences count calendar units on the wall clock.** `diffZoned`,
    `diffZonedAsDuration` and `intervalLengthZoned` follow TC39
    DifferenceZonedDateTime: days, weeks, months and years are counted on the
    zone's wall clock (noon to noon across a 23-hour day is `1` day), and hours
    and smaller are exact time. Two values in different zones have no shared
    wall clock, so a calendar unit returns `null`/`""`; hours still work.
    Convert both ends to one zone with `convertZonedToZoned` first, or diff the
    UTC instants with `diffUtc` if UTC days are what you mean.
    `intervalOverlappingDaysZoned`/`intervalOverlappingDaysUnix` count the
    distinct local dates the overlap touches: a deleted day is not counted, and a
    fall-back into the previous date counts that date.
13. **Zone names and leap seconds.** Every IANA name is a zone, including
    single-component links (`Japan`, `Zulu`, `EST5EDT`), in any case.
    `toOffsetInstant` returns IANA casing (`"asia/kolkata"` gives
    `"Asia/Kolkata"`). `:60` is invalid in every spelling (`T`, `t`, space,
    basic format) and every zoned function returns its sentinel for it rather
    than reading `:59`; only `timescale/` and `gnss/` accept a listed one (for `gnss/`, see the `gmt-gnss` skill).
14. **A zoned value formats in its own zone.** `formatZonedDateTime`,
    `formatZonedRange` and `formatZonedToParts` return `""`/`[]` for a
    `timeZone` option. To show an instant in another zone, use
    `formatUtc(convertZonedToUtc(value), locale, { timeZone })`.
15. **Operating hours are local windows resolved in the schedule's zone.** An
    `OperatingSchedule` is `{ timeZone, weekly, holidays?, overrides? }`:
    `weekly` maps ISO weekdays `1`–`7` to half-open `LocalWindow`s
    (`{ from: "09:00", to: "17:00" }`); a `to` at or before `from` wraps past
    midnight and the window belongs to the date it starts on. Holidays are local
    dates (a `BusinessCalendar` is accepted; only its `holidays` are read); an
    override replaces one date's windows, holiday or not. Every edge goes
    through `resolveLocal` with `disambiguation` (default `"compatible"`), so a
    23:00–06:00 window is 8 real hours across New York's fall-back night.
    `recurringWindows(weekly, range, zone)` and `operatingIntervals(schedule,
    range)` return merged open intervals; `isOpenAt`, `nextOpenAt` and
    `nextCloseAt` answer point questions; `operatingTimeBetween(start, end,
    schedule)` is open time elapsed (hours as the largest unit), and
    `addOperatingTime(start, "PT8H", schedule)` is the SLA deadline. Searches
    stop at `within` (default `"P1Y"`) and return `""` past it; `P1D` is not
    open time and returns `""`.
16. **A zoned string names one instant in every reader.** Temporal writes a
    zone's offset rounded to the minute, so a zone with a sub-minute offset
    (`Africa/Monrovia` stood at −00:44:30 until 1972) is written `-00:45`.
    Every function that reads a moment (`toNanoseconds`, `spanNs`, `Interval`
    endpoints, `floorToZone`, `getTimeZoneOffset`, and the `transport/` functions that read one) reads an offset written to the minute as the
    bracketed zone's real offset when it is that offset rounded (TC39
    `ToTemporalZonedDateTime`, match-minutes):
    `1960-01-01T00:20:00-00:45[Africa/Monrovia]` is `01:04:30Z`. So a zoned
    string GMT wrote reads back as the instant it was written for. Otherwise
    the written offset fixes the instant. A function that reads only the
    instant does not validate the bracket, and the bracket never supplies its
    rendering zone. A function that keeps the zone (`isValidZonedDateTime`,
    `toOffsetInstant`, every `zoned/` function, a zoned
    `relativeTo`) rejects a bracket that contradicts the offset, and an offset
    written with seconds must be the zone's offset exactly:
    `-00:45:00[Africa/Monrovia]` is invalid, `-00:44:30[Africa/Monrovia]` is
    valid. Two limits are Temporal's own. A wall time repeated inside a
    sub-minute offset change, written to the minute, reads as its first pass
    (`1952-10-15T23:59:59-11:20[Pacific/Niue]`); write the offset with seconds
    to name the second. A zoned read refuses a local date of −271821-04-19,
    which an instant reader accepts; pass that instant in `Z` form.
17. **Daylight time is read from the zone's clock changes.**
    `isInDaylightSaving(zoned)` and `hasDaylightSaving(timeZone, { at })`
    apply one rule, GMT's own definition and not the tz database's daylight
    flag (no JavaScript API exposes it): daylight time runs from a forward
    change of the zone's clocks to the backward change of the same size that
    undoes it, less than 365 days later. A forward change never undone is a
    change of standard time, so
    `isInDaylightSaving("2016-12-01T12:00:00+03:00[Europe/Istanbul]")` is
    `false`. The higher of two alternating offsets is the daylight one:
    `Europe/Dublin` in summer, `Africa/Casablanca` at `+01:00`.
    `hasDaylightSaving` is `true` when the zone is in daylight time at `at`
    or a daylight period begins less than 365 days after it. Pass `at` (an
    ISO 8601 instant string) for an answer that does not depend on the day
    the code runs: `hasDaylightSaving("Europe/Istanbul", { at:
    "2015-06-15T12:00:00Z" })` is `true`, and with `"2016-06-15T12:00:00Z"`
    it is `false`. Without `at` the reference is the current instant. Both
    read the runtime's time zone data, so an answer can change when that data
    does. The JSDoc of `isInDaylightSaving` lists what the rule reads as
    standard time.
18. **A recurrence rule or cron line in a zone is local, so a transition
    touches it, and every row says how.** `parseRecurrenceRule(value)` reads
    an RFC 5545 RECUR value (the text after `RRULE:`) and
    `parseCronExpression(value)` reads five crontab fields or a nickname; both
    return `null` for anything else (no seconds field, no `@reboot`, no `L`,
    `W`, `#` or `?`, no `EXRULE`). `expandRecurrence(rule, start, timeZone,
    window, options?)` and `cronRuns(expression, timeZone, window, policy)`
    return rows in `instant` order, or `[]` for bad input. The window is
    `{ start, end }` (half-open) or `{ after, count }` (1 to 10,000). Every
    row carries `classification` (`"unique"`, `"nonexistent"`, `"ambiguous"`).

    ```typescript
    const rule = parseRecurrenceRule("FREQ=DAILY;COUNT=3"); // { frequency: "daily", interval: 1, firstDayOfWeek: 1, count: 3 }
    expandRecurrence(rule, "2024-03-09T02:30:00", "America/New_York", { after: "2024-03-08T00:00:00Z", count: 3 })
      .map((row) => [row.local, row.instant, row.classification]);
    // [["2024-03-09T02:30:00", "2024-03-09T07:30:00Z", "unique"],
    //  ["2024-03-10T02:30:00", "2024-03-10T07:30:00Z", "nonexistent"], // 02:30 does not exist: RFC 5545 section 3.3.5
    //  ["2024-03-11T02:30:00", "2024-03-11T06:30:00Z", "unique"]]
    ```

    - `expandRecurrence` takes `disambiguation` (`"compatible"` default,
      `"earlier"`, `"later"`, `"reject"`) and `rdate`/`exdate` lists. `"reject"`
      returns `[]` when a start, a wall-time RDATE or EXDATE, or a returned row
      is non-unique. `DTSTART` is always the first occurrence. `UNTIL` must be
      UTC (`...Z`), with a capital `T` and `Z`.
    - `cronRuns` has no default `policy`: pass `"crontabMatch"` (a time that
      does not exist never runs; a repeated time runs twice) or
      `"daemonCatchUp"` (a fixed-time job in a gap shorter than 3 hours runs at
      the change; one in an overlap up to 3 hours runs once). A missing or
      other policy returns `[]`.

    ```typescript
    cronRuns(parseCronExpression("30 2 * * *"), "America/New_York",
      { start: "2024-03-09T00:00:00Z", end: "2024-03-12T00:00:00Z" }, "daemonCatchUp")
      .map((run) => run.instant); // ["2024-03-09T07:30:00Z", "2024-03-10T07:00:00Z", "2024-03-11T06:30:00Z"]
    ```

    - When day of month and day of week are both restricted (neither is `*`
      or `*/n`), a day matching either runs; otherwise both must match.
      `dayOfWeek` is stored as ISO 1 to 7 (cron `0` and `7` are 7).
    - A rule that never matches (`FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30`) or a
      window over 10,000 rows returns `[]`.
19. **Read the docs site.** This skill is a routing pointer. The map of the
    docs is `https://northguild.dev/gmt/llms.txt`, and each page
    has a `.md` twin that holds its text. The JSDoc ships in the installed
    package: `node_modules/@northguild/gmt/dist/**/*.d.ts`.

## Key functions

- **Current**: `getZonedNow`, `getZonedToday`
- **Formatting**: `formatZonedDateTime`, `formatZonedRange`,
  `formatRelativeZoned`, `formatTimeZoneName`
- **Validation**: `isValidTimeZone`, `isValidZonedDateTime`,
  `hasDaylightSaving` (`{ at }`), `getDstTransitions`, `isInDaylightSaving`
- **Conversion**: `convertPlainDateTimeToZoned`, `convertZonedToPlainDateTime`,
  `convertUtcToZoned`, `convertZonedToUtc`, `convertZonedToCalendar`,
  `convertUtcToUnix`, `convertUnixToUtc`
- **Arithmetic (with disambiguation)**: `addZoned`, `subtractZoned`, `clampZoned`,
  `closestZonedTo`, `setZoned`, `cycleZoned`, `roundZoned`
- **Boundaries (real by default)**: `startOfZoned`, `endOfZoned`,
  `startOfQuarterForZoned`, `endOfQuarterForZoned`,
  `getLocaleZonedStartOfWeek`, `getLocaleZonedEndOfWeek`, `startOfUnix`,
  `endOfUnix`, `mapZonedHoursInDay`, `getHoursInZonedDay`
- **Offset/DST reads**: `getZonedOffset`, `getZonedOffsetAs`,
  `getTimeZoneOffset`, `parseTimeZoneFromZoned`
- **Offset-preserving instants**: `toOffsetInstant`, `fromOffsetInstant`,
  `isValidUtcOffset` (the pair's `±HH:MM[:SS]` offset; not `Z`, not `+0530`)
- **Local-time resolution**: `classifyLocal`, `resolveLocal`,
  `classifyStoredZoned`
- **Zone-aware buckets**: `floorToZone`, `bucketRange`,
  `isValidZoneBucketUnit`
- **Operating hours**: `recurringWindows`, `operatingIntervals`, `isOpenAt`,
  `nextOpenAt`, `nextCloseAt`, `operatingTimeBetween`, `addOperatingTime`
- **Recurrence and cron**: `parseRecurrenceRule`, `expandRecurrence`,
  `parseCronExpression`, `cronRuns`

## References

- [Zoned operations guide](https://northguild.dev/gmt/guides/zoned-date-operations/zoned-operations/)
- [Recurrence and cron guide](https://northguild.dev/gmt/guides/zoned-date-operations/recurrence-and-cron/)
- [DST Disambiguation guide](https://northguild.dev/gmt/guides/concepts/dst-disambiguation/)
