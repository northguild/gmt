---
name: gmt-timezone
description: >
  Timezone-aware operations — zoned now, zoned formatting, plain↔zoned↔UTC↔Unix
  conversion, DST disambiguation, toOffsetInstant, classifyLocal/resolveLocal,
  real boundaries (startOfZoned/endOfZoned/startOfUnix/endOfUnix), hours in a
  local day, floorToZone/bucketRange, calendar-annotated strings, transport
  legs (transitTime, etaAtZone, dwellTime, crossingTime, scheduleDelivery),
  cut-offs (cutoffAt, cutoffSchedule, isPastCutoff, timeToCutoff), punctuality
  (scheduleDeviation, classifyPunctuality, punctualityRate, bestAvailable,
  estimateDrift over PLN/EST/REQ/ACT, nextDeparture), free time
  (freeTimeExpiry, chargeableDays, demurrageClock), billingTimeline,
  bolTimestamp, multimodalETA, EDI timestamps (parseEdifactDateTime,
  parseX12DateAndTime, x12TimeCodeOffset, parseEpcisEvent,
  classify*/format*/isValid*), operating hours (OperatingSchedule,
  recurringWindows, operatingIntervals, isOpenAt, nextOpenAt, nextCloseAt,
  operatingTimeBetween, addOperatingTime), and daylight time
  (isInDaylightSaving, hasDaylightSaving).
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
  - 'northguild/gmt:packages/gmt/src/instant/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/calendar/calculate/index.ts'
  - 'northguild/gmt:packages/gmt/src/calendar/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/calendar/hours/index.ts'
  - 'northguild/gmt:packages/gmt/src/types/operating-schedule.ts'
  - 'northguild/gmt:packages/gmt/src/types/transport-timestamps.ts'
  - 'northguild/gmt:packages/gmt/src/transport/calculate/index.ts'
  - 'northguild/gmt:packages/gmt/src/transport/compare/index.ts'
  - 'northguild/gmt:packages/gmt/src/transport/convert/index.ts'
  - 'northguild/gmt:packages/gmt/src/intermodal/calculate/index.ts'
  - 'northguild/gmt:packages/gmt/src/intermodal/format/index.ts'
  - 'northguild/gmt:packages/gmt/src/intermodal/parse/index.ts'
  - 'northguild/gmt:packages/gmt/src/intermodal/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/types/edi.ts'
  - 'northguild/gmt:packages/gmt/src/types/epcis.ts'
  - 'northguild/gmt:packages/gmt/src/types/two-digit-year.ts'
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
- The user is reading or writing a UN/EDIFACT `DTM` value, an X12 date, time,
  time code or date time period, or a GS1 EPCIS event time, and must know
  whether its offset was stated.
- The user is asking whether a gate, desk, office or venue is open at an
  instant, when it next opens or closes, how many working hours passed between
  two instants, or when an SLA measured in open hours falls due — or is
  expanding a recurring local window such as a night curfew.

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
    required and always the rendering zone — a bracket on the input never
    supplies it.
    `scheduleDelivery(legs, { startTimeZone? })` chains legs into `{ eta,
    legTimes }`: each leg leaves at its explicit `departure` or at the previous
    arrival plus that leg's `dwellAfter`, the minimum connect time. A scheduled
    departure earlier than that is a missed connection and returns `null`
    (equal passes). A departure is exact (instant or zoned string) or a
    zoneless wall time: on the first leg it is read in `startTimeZone`, on a
    later leg in the previous leg's `timeZone` (where that leg leaves from),
    both with `"compatible"` resolution (ambiguous → earlier, skipped →
    later). On a later leg, a repeated hour instead takes the earliest pass
    at or after the previous arrival plus its dwell. A
    negative leg `duration` is `null`; the last leg's `dwellAfter` is echoed,
    never added. `mode`, `origin` and `destination` are opaque tags echoed on
    each `LegTime`. An empty array returns `{ eta: "", legTimes: [] }`.
16. **Cut-offs count back from the caller's event.**
    `cutoffAt(anchor, offset, { timeZone, atLocalTime?, calendar?, roll? })`
    takes an offset off the anchor (loading, departure or arrival are
    different instants; it never guesses which). With `atLocalTime` the
    offset's exact part comes off the anchor's instant first, its calendar
    part off the local date, and the cut-off is that time of day: `P2D` at
    `"17:00"` is 17:00 two days before, not 48 hours. Without it the offset
    is `ZonedDateTime#subtract` (`P2D` keeps the wall clock, `PT96H` is 96
    exact hours). `calendar` and `roll` go together or not at all — there is
    no default roll, as in `rollDate`; either alone is `""`. A repeated hour
    takes the first pass (RFC 5545 §3.3.5); a skipped hour is `""`. It does
    not check that the cut-off is before the anchor.
    `cutoffSchedule(anchor, [{ name, offset, atLocalTime? }], options)`
    sorts the stack by instant and returns `[]` if any entry fails.
    `isPastCutoff(now, cutoff)` is `true` from the cut-off instant on;
    `timeToCutoff(now, cutoff)` is exact hours, `PT0S` at it, negative after.
17. **Planned versus actual is exact time under the caller's tolerance.**
    `scheduleDeviation(planned, actual)` is `actual − planned` in exact hours
    (`"PT14M"` late, `"-PT5M"` early; a fall-back delay is `PT1H`, never
    `PT0S`). `classifyPunctuality(planned, actual, { late, early? })` returns
    `"early" | "onTime" | "late"`, or `null` on invalid input: both edges are
    outside (exactly `late` is late), and without `early` every early arrival
    is on time. There is no default tolerance; tolerances are exact durations
    (a day is 24 hours; years, months, weeks or negative return `null`).
    `punctualityRate(pairs, tolerance)` returns `{ onTime, total, rate }`,
    judging every pair under a tolerance read once; an empty list or any
    invalid pair is `null`. A `TimestampEvent` is `{ classifier: "PLN" |
    "EST" | "REQ" | "ACT", at, recordedAt }` (DCSA vocabulary).
    `bestAvailable(events)` returns `{ at, classifier }`: `ACT` whenever one
    exists, else `PLN`, else `REQ`, else `EST`, newest `recordedAt` within the
    class — never an `EST` shown as an actual. `estimateDrift(events, {
    tolerance? })` reports first-to-last `EST` drift, `revisions` and
    `exceedsTolerance` (strictly greater, either direction; `null` without a
    tolerance), and is `null` with fewer than two `EST`s.
    `nextDeparture(after, timetable, { minimumConnection? })` returns the
    first departure at or after `after + minimumConnection`: a list entry
    echoed as written (ready for `scheduleDelivery`'s `departure`), or for
    `{ headway, from, to }` (a GTFS `frequencies.txt` row) `from + k × headway`
    in the half-open `[from, to)`, written the way `from` was. Every moment
    must carry its offset; a wall time without one is `""`.
18. **Free time is counted in the terminal's local days; the start day and the
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
19. **Billing deadlines are dates counted from an anchor, and every window is
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
20. **A B/L date is a local date; a multimodal ETA keeps transit and dwell
    apart.** `bolTimestamp(value, event, { timeZone })` returns the
    `YYYY-MM-DD` date on the local clock in `timeZone` at the instant `value`:
    DCSA Bill of Lading 3.0 types `issueDate`, `receivedForShipmentDate` and
    `shippedOnBoardDate` as dates with no time or offset. `event` is
    `"issue" | "received" | "shippedOnBoard"`, one per DCSA date field; all
    three render the same way and anything else is `""`. `timeZone` is
    required (no UTC default): the place of issue for `issue`, the loading
    terminal for `received` and `shippedOnBoard`. 21:00 in New York
    is 01:00Z the next day, so the UTC date is wrong. Only the instant is read;
    a zoneless value is `""`. `multimodalETA(legs, { startTimeZone? })` takes
    `scheduleDelivery`'s `Leg[]` and returns `{ eta, totalLegs, totalTransit,
    totalDwell }`: transit is the legs' durations added up, dwell the time
    actually spent at handoffs (a wait for a scheduled departure included; the
    last leg's `dwellAfter` excluded), both with hours as the largest unit, and
    they sum to the elapsed time. Every `scheduleDelivery` rule applies, so a
    missed connection is `null`. An empty array is `{ eta: "", totalLegs: 0,
    totalTransit: "PT0S", totalDwell: "PT0S" }`. Dwell is never estimated.
21. **An EDI timestamp is read by the function for its kind of value, and
    nothing the code does not state is guessed.** Each kind has a `parse…`,
    `format…` and `isValid…` function named for it (`parseEdifactDate`,
    `formatEdifactDate`, `isValidEdifactDate`), and `format` is typed to that
    kind's codes. UN/EDIFACT `DTM` (value 2380 against format code 2379):
    `EdifactDate` (`102`), `EdifactTime` (`401`, `402`), `EdifactDateTime`
    (`203`, `204`), `EdifactOffsetDateTime` (`205`, `208`, `303`, `304`),
    `EdifactDatePeriod` (`718`), `EdifactDateTimePeriod` (`719`). X12 (element
    1251 against qualifier 1250, in `DTP` and `DTM-05`/`06`): `X12Date` (`D8`,
    `DB`), `X12Time` (`TM`, `TS`), `X12DateTime` (`DT`, `RTS`), `X12DateRange`
    (`RD8`, `RD`), `X12DateTimeRange` (`RDT`, `DTS`). `parseX12Time(value)`
    with no `format` reads element 337, tenths and hundredths included
    (`"14300012"` is `"14:30:00.12"`). A parser returns one value:
    `"2024-06-15"`, `"14:30:00"`, `"2024-06-15T14:30:00"`,
    `"2024-06-15T14:30:00+02:00"` (the string `toOffsetInstant` reads), or
    `{ start, end }` for a period or range. The sentinel is `""`, or `null`
    for a period, a range, a zone or a classifier. A period formatter takes
    `(start, end, format)`. No EDI function takes options. X12 freight is
    three calls: `parseX12DateAndTime("20240615", "1430")` is
    `"2024-06-15T14:30:00"` (elements 373 and 337 of `AT7`, `G62` or `DTM`,
    both required), `x12TimeCodeOffset("20")` is `"-05:00"`, and
    `resolveLocal(local, offset)` is `"2024-06-15T19:30:00Z"`. For a code
    held as a plain string, `classifyEdifactDtmFormat`,
    `classifyX12DateTimePeriodFormat` and `classifyX12TimeCode` return
    `{ kind, format }` or `{ kind, timeCode }`, or `null` for a code no
    function reads; testing `kind` narrows the code with no cast.
    `parseEpcisEvent({ eventTime, eventTimeZoneOffset })` returns
    `{ instant, offset, local }`; both fields are required and need not
    agree. Five no-guess rules. (a) An offsetless value never becomes UTC:
    `203`, `204`, `DT`, `RTS` and `parseX12DateAndTime` return a local
    date-time; pass it and an IANA zone to `resolveLocal`. (b) A named X12
    time code is a zone name, not an offset: `x12TimeCodeZone("ES")` is
    `{ zone: "Eastern", daylight: false }` and `ET` has `daylight: null`,
    while `x12TimeCodeOffset` reads `01`–`29`, `UT` and `GM`, and `13`–`24`
    count down (`13` is `-12:00`). Each returns its sentinel for the other's
    codes. (c) The `ZZZ` of `303` and `304` is an offset only: `+02`, `UTC`
    and `GMT` are read, and letters such as `CET` return `""`. (d) A
    two-digit year is not read by any EDI function: `101`, `201`, `202`,
    `206`, `207`, `301`, `302`, `713`, `717`, `D6`, `TT`, `TR`, `RD6` and
    `TU`. Read one with `parseDateWithPattern` or `parseDateTimeWithPattern`,
    a `yy` pattern and `{ yearWindow }`: a start year such as `2000` (a fixed
    window, for stored data) or `"rolling"` (50 years before the current UTC
    year to 49 after). Without `yearWindow` a `yy` pattern returns `""`. (e)
    `209`, `404`, `406`, `TC`, `EH`, `DDT`, `DTD`, `RTM` and `UN` are not
    read: none states one date, time or date-time. A UN/EDIFACT period has no
    hyphen (`2024061520240620` under `718`) and an X12 range has one
    (`20240615-20240620` under `RD8`); a reversed one returns the sentinel.
    Pass a UN/EDIFACT parser the unescaped value (`+02`, not `?+02`). A
    formatter cuts seconds and fractions to the code's mask and never rounds.
    It writes `ZZZ` as `±HH`, and `+05:30` under `303` or `304` returns `""`:
    use `205` or `208`. Each value validator is true exactly when its parser
    returns a value (`isValidX12DateAndTime(date, time)` for the freight
    pair), and `isValidEdifactDtmFormat`, `isValidX12DateTimePeriodFormat`
    and `isValidX12TimeCode` check a code alone. `isValidEpcisEvent` is
    `isValidEpcisEventTime` and `isValidEpcisTimeZoneOffset` together: the
    `epcisEventTime` regex matches `2024-02-30`, the validator does not.
22. **Operating hours are local windows resolved in the schedule's zone.** An
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
23. **A zoned string names one instant in every reader.** Temporal writes a
    zone's offset rounded to the minute, so a zone with a sub-minute offset
    (`Africa/Monrovia` stood at −00:44:30 until 1972) is written `-00:45`.
    Every function that reads a moment (`toNanoseconds`, `spanNs`, `Interval`
    endpoints, `floorToZone`, `getTimeZoneOffset`, `scheduleDeviation`,
    `timeToCutoff`, `dwellTime`) reads an offset written to the minute as the
    bracketed zone's real offset when it is that offset rounded (TC39
    `ToTemporalZonedDateTime`, match-minutes):
    `1960-01-01T00:20:00-00:45[Africa/Monrovia]` is `01:04:30Z`. So a zoned
    string GMT wrote reads back as the instant it was written for. Otherwise
    the written offset fixes the instant. A function that reads only the
    instant does not validate the bracket, and the bracket never supplies its
    rendering zone. A function that keeps the zone (`isValidZonedDateTime`,
    `transitTime`, `toOffsetInstant`, every `zoned/` function, a zoned
    `relativeTo`) rejects a bracket that contradicts the offset, and an offset
    written with seconds must be the zone's offset exactly:
    `-00:45:00[Africa/Monrovia]` is invalid, `-00:44:30[Africa/Monrovia]` is
    valid. Two limits are Temporal's own. A wall time repeated inside a
    sub-minute offset change, written to the minute, reads as its first pass
    (`1952-10-15T23:59:59-11:20[Pacific/Niue]`); write the offset with seconds
    to name the second. A zoned read refuses a local date of −271821-04-19,
    which an instant reader accepts; pass that instant in `Z` form.
24. **Daylight time is read from the zone's clock changes.**
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
25. **Read the README.** This skill is a routing pointer. For the full DST
    disambiguation walkthrough, code examples, and locale ICU notes, read the
    installed package's `README.md` and the source JSDoc.

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
- **Local-time resolution**: `classifyLocal`, `resolveLocal`
- **Zone-aware buckets**: `floorToZone`, `bucketRange`,
  `isValidZoneBucketUnit`
- **Transport legs and dwell**: `transitTime`, `etaAtZone`, `dwellTime`,
  `crossingTime`, `scheduleDelivery`
- **Cut-offs and deadlines**: `cutoffAt`, `cutoffSchedule`, `isPastCutoff`,
  `timeToCutoff`
- **Punctuality and timestamp classes**: `scheduleDeviation`,
  `classifyPunctuality`, `punctualityRate`, `bestAvailable`, `estimateDrift`,
  `nextDeparture`
- **Free time and demurrage**: `freeTimeExpiry`, `chargeableDays`,
  `demurrageClock`
- **Billing deadlines**: `billingTimeline`
- **Bill of lading dates and multimodal ETA**: `bolTimestamp`, `multimodalETA`
- **EDI and event timestamps**: `parseEdifactDate`, `parseEdifactTime`,
  `parseEdifactDateTime`, `parseEdifactOffsetDateTime`,
  `parseEdifactDatePeriod`, `parseEdifactDateTimePeriod`, `parseX12Date`,
  `parseX12Time`, `parseX12DateTime`, `parseX12DateRange`,
  `parseX12DateTimeRange`, `parseX12DateAndTime`, `x12TimeCodeOffset`,
  `x12TimeCodeZone`, `classifyEdifactDtmFormat`,
  `classifyX12DateTimePeriodFormat`, `classifyX12TimeCode`,
  `parseEpcisEvent`; a `format…` and an `isValid…` for each `parseEdifact…`
  kind, for `X12Date`, `X12Time`, `X12DateTime`, `X12DateRange` and
  `X12DateTimeRange`, and for `EpcisEvent`; `isValidX12DateAndTime`,
  `isValidEpcisEventTime`, `isValidEpcisTimeZoneOffset`,
  `isValidEdifactDtmFormat`, `isValidX12DateTimePeriodFormat`,
  `isValidX12TimeCode`
- **Operating hours**: `recurringWindows`, `operatingIntervals`, `isOpenAt`,
  `nextOpenAt`, `nextCloseAt`, `operatingTimeBetween`, `addOperatingTime`

## References

- [README — Timezone and Calendar examples](README.md)
- [DST Disambiguation guide](https://gmt-dox.northguild.workers.dev/guides/concepts/dst-disambiguation/)
