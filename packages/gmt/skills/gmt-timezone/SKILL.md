---
name: gmt-timezone
description: >
  Timezone-aware operations — get zoned now, format zoned datetimes/ranges,
  convert between plain↔zoned↔UTC↔Unix, DST disambiguation on construction and
  arithmetic, the instant-plus-offset pair, classifying a zoneless wall time
  before resolving it, real zone unit boundaries
  (startOfZoned/endOfZoned/startOfUnix/endOfUnix), hours in a local day,
  flooring or bucketing on local boundaries (floorToZone/bucketRange),
  calendar-annotated zoned strings, zoned values at the range limits,
  transport — transitTime, etaAtZone, dwellTime (local calendar days crossed),
  crossingTime, scheduleDelivery (multi-leg ETA, missed connections) —
  intermodal free time — freeTimeExpiry, chargeableDays (dates charged, tier
  bands), demurrageClock (which events a clock runs between) — and
  billingTimeline (invoice, dispute and resolution deadlines). Reads the
  installed package README.md and source JSDoc for API details; this skill is
  a routing pointer, not an API dump.
sources:
  - 'northguild/gmt:README.md'
  - 'northguild/gmt:packages/gmt/src/zoned/get/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/format/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/compare/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/convert/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/calculate/addZoned.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/calculate/startOfZoned.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/calculate/roundZoned.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/calculate/getHoursInZonedDay.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/calculate/clampZoned.ts'
  - 'northguild/gmt:packages/gmt/src/unix/get/index.ts'
  - 'northguild/gmt:packages/gmt/src/utc/get/index.ts'
  - 'northguild/gmt:packages/gmt/src/utc/convert/index.ts'
  - 'northguild/gmt:packages/gmt/src/instant/convert/index.ts'
  - 'northguild/gmt:packages/gmt/src/calendar/calculate/index.ts'
  - 'northguild/gmt:packages/gmt/src/calendar/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/transport/calculate/index.ts'
  - 'northguild/gmt:packages/gmt/src/transport/convert/index.ts'
  - 'northguild/gmt:packages/gmt/src/intermodal/calculate/index.ts'
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.18.0'
---

# GMT Timezone

Use this skill when the task requires IANA time zone awareness — formatting,
converting between time zones, or doing arithmetic that must respect DST.

## When to load

- The user needs the current time in a specific timezone (`"America/New_York"`).
- The user wants to format a datetime with its zone attached.
- The user needs to convert a plain datetime to a zoned instant, or between
  timezones, or between UTC and Unix epochs.
- The user is adding/subtracting durations across a DST transition.
- The user has a timestamp that must keep the local offset it happened at, or a
  local wall time that arrived with no offset at all.
- The user needs the start or end of a local hour, day, week, month or quarter.
- The user is grouping or aggregating UTC timestamps by local day, hour, week or
  month — an observability rollup, a chargeable-days count.
- The user is adding a leg's transit time to a departure, showing an arrival in
  the zone where it lands, or counting how long cargo, a vessel or a patient sat
  somewhere in local calendar days.
- The user is working out when a container's free time ends, how many days of
  demurrage or detention are chargeable and for which dates, or which events a
  charge's clock runs between.

## Core rules

1. **Use IANA timezone ids, not raw offsets.** `"2024-03-15T14:30:45[America/New_York]"`
   is correct; bare `"-05:00"` loses the zone and can't observe DST rules.
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
6. **An offset is not a zone.** `-05:00` does not identify `America/New_York`.
   `toOffsetInstant` splits a timestamp into `{ instant, offset, timeZone? }` —
   the shape EPCIS 2.0, EDIFACT DTM and DICOM all exchange, because the instant
   orders events and the offset renders them where they happened, and neither
   derives from the other. Keep the zone for what is still to be scheduled.
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
    `[u-ca=<id>]` (`"2024-10-03T14:30:45-04:00[America/New_York][u-ca=hebrew]"`).
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
    `toOffsetInstant` returns IANA casing (`"america/new_york"` gives
    `"America/New_York"`). `:60` is invalid in every spelling (`T`, `t`, space,
    basic format) and every zoned function returns its sentinel for it rather
    than reading `:59`.
14. **A zoned value formats in its own zone.** `formatZonedDateTime`,
    `formatZonedRange` and `formatZonedToParts` return `""`/`[]` for a
    `timeZone` option. To show an instant in another zone, use
    `formatUtc(convertZonedToUtc(value), locale, { timeZone })`.
15. **Transport legs are exact time; dwell is counted in local days.**
    `transitTime(departure, duration)` adds hours, minutes and seconds as
    elapsed time (`P1D` is 24 exact hours) in the departure's own zone, so a leg
    across a DST transition lands at the wall time the vehicle really arrives;
    years, months and weeks return `""`, and a bracketed zone that contradicts
    its offset is rejected rather than reinterpreted. `etaAtZone(instant, zone)`
    renders a moment in the zone the caller names — no disambiguation arises,
    the offset in the result tells the two passes of a fall-back hour apart, and
    GMT never resolves a port, airport or station code to a zone.
    `dwellTime(entry, exit, targetZone?)` returns `{ duration, enter, exit,
    calendarDays }`; `calendarDays` is the number of distinct local dates the
    half-open `[entry, exit)` touches, walked across the zone's real transitions
    (a skipped date is not counted, a re-entered one only once), and is the
    library's one "local days crossed" count.
    Bare instants with no `targetZone` return `null`: an offset is not a place.
    `crossingTime(entry, exit, targetZone)` returns `{ duration, enter, exit }`
    with no day count (a crossing that needs one is a dwell); `targetZone` is
    required and always the rendering zone — a bracket on the input is ignored.
    `scheduleDelivery(legs, { startTimeZone? })` chains legs into `{ eta,
    legTimes }`: each leg leaves at its explicit `departure` or at the previous
    arrival plus that leg's `dwellAfter`, the minimum connect time. A scheduled
    departure earlier than that is a missed connection and returns `null`
    (equal passes). Departures must be exact (instant or zoned string); only a
    zoneless first-leg departure is read in `startTimeZone`, with
    `"compatible"` resolution (ambiguous → earlier, skipped → later). A
    negative leg `duration` is `null`; the last leg's `dwellAfter` is echoed,
    never added. `mode`, `origin` and `destination` are opaque tags echoed on
    each `LegTime`. An empty array returns `{ eta: "", legTimes: [] }`.
16. **Free time is counted in the terminal's local days; the start day and the
    basis are tariff terms, never defaults.**
    `freeTimeExpiry(clockStart, freeDays, { basis, timeZone, firstDay, calendar? })`
    returns `{ freeTimeStart, lastFreeDay, expiresAt }`: local dates in
    `timeZone`, and the first instant of the day after the last free day.
    `firstDay` (`"eventDay"` | `"nextDay"`) has no default because the two
    differ by a day of charges; `basis: "working"` needs a `BusinessCalendar`
    and returns `null` without one. `chargeableDays(clockStart, clockEnd,
    freeDays, options)` also needs `chargeBasis` (no default): many tariffs
    count both in calendar days; where a tariff grants free time in working
    days the days after it are mostly charged as calendar days, and some
    tariffs charge working days only. It counts the days on or after
    `expiresAt` the half-open dwell touched, lists them as `chargedDates`, and
    splits them into `tiers` bands; `freeDays: 0` is allowed there.
    `demurrageClock(events, scope, { direction, startEvent? })` selects the
    events per leg: import demurrage and storage run discharge (or
    availability) to gate-out, detention gate-out to empty return; export
    demurrage gate-in to loaded, detention empty release to gate-in; `combined`
    runs both as one period. No standard fixes how these days are counted;
    every term is the tariff's.
17. **Billing deadlines are dates counted from an anchor, and every window is
    the caller's.** `billingTimeline({ anchorOn, invoiceIssuedOn?,
    requestReceivedOn? }, { issueDays, disputeDays, resolutionDays,
    agreedResolutionOn? })` returns `{ invoiceDeadline, issuedByDeadline,
    disputeDeadline, requestedByDeadline, resolutionDeadline }`. Day zero is
    the anchor and each deadline is `date + days` on the ISO calendar; a date
    is by the deadline when it is on or before it. No window has a default (a
    missing one returns `null`); fields whose input does not exist yet are
    `null`, so an anchor alone is a forecast. The anchor is whatever date the
    caller counts from: the last charged date
    (`chargedDates.at(-1)`), or for a re-bill the issuance date of the invoice
    received. Reduce an instant to the billing party's local date first with
    `convertUtcToPlainDate(instant, { timeZone })`. A request before its
    invoice, or an agreed date before the request, returns `null`. GMT
    computes dates, not liability.
18. **Read the README.** This skill is a routing pointer. For the full DST
    disambiguation walkthrough, code examples, and locale ICU notes, read the
    installed package's `README.md` and the source JSDoc.

## Key functions

- **Current**: `getZonedNow`, `getZonedToday`
- **Formatting**: `formatZonedDateTime`, `formatZonedRange`,
  `formatRelativeZoned`, `formatTimeZoneName`
- **Validation**: `isValidTimeZone`, `isValidZonedDateTime`,
  `hasDaylightSaving`, `getDstTransitions`, `isInDaylightSaving`
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
- **Offset-preserving instants**: `toOffsetInstant`, `fromOffsetInstant`
- **Local-time resolution**: `classifyLocal`, `resolveLocal`
- **Zone-aware buckets**: `floorToZone`, `bucketRange`,
  `isValidZoneBucketUnit`
- **Transport legs and dwell**: `transitTime`, `etaAtZone`, `dwellTime`,
  `crossingTime`, `scheduleDelivery`
- **Free time and demurrage**: `freeTimeExpiry`, `chargeableDays`,
  `demurrageClock`
- **Billing deadlines**: `billingTimeline`

## References

- [README — Timezone and Calendar examples](README.md)
- [DST Disambiguation guide](https://gmt-dox.northguild.workers.dev/guides/concepts/dst-disambiguation/)
