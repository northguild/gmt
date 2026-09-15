---
name: gmt-timezone
description: >
  Timezone-aware operations — get zoned now, format zoned datetimes/ranges,
  convert between plain↔zoned↔UTC↔Unix, DST disambiguation control on
  construction and arithmetic, the instant-plus-offset pair, classifying a
  zoneless wall time before resolving it, real zone unit boundaries
  (startOfZoned/endOfZoned/startOfUnix/endOfUnix, never after the input), hours
  in a local day, and flooring or bucketing instants on local calendar
  boundaries (floorToZone/bucketRange) instead of roundZoned, calendar-annotated
  zoned strings, and zoned values exact at the range limits (Australia/Sydney
  at the maximum, Etc/GMT+12 at the minimum). Reads the
  installed package README.md and source JSDoc for API details; this skill is a
  routing pointer, not an API dump.
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
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.15.0'
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

## Core rules

1. **Use IANA timezone ids, not raw offsets.** `"2024-03-15T14:30:45[America/New_York]"`
   is correct; bare `"-05:00"` loses the zone and can't observe DST rules.
2. **DST disambiguation.** `convertPlainDateTimeToZoned`, `addZoned` and
   `setZoned` accept `disambiguation` (`"compatible"` | `"earlier"` |
   `"later"` | `"reject"`) for gap/overlap resolution. On `addZoned` it only
   affects fall-back overlaps, **not** spring-forward gaps — use
   `convertPlainDateTimeToZoned` with `"reject"` for gap-safety.
3. **Boundaries are always the real zone boundary.** `startOfZoned`,
   `endOfZoned`, `startOfQuarterForZoned`, `endOfQuarterForZoned`,
   `getLocaleZonedStartOfWeek`, `getLocaleZonedEndOfWeek` and their `unix/`
   counterparts (`startOfUnix`,
   `endOfUnix`, …) return the real start and end of the unit that contains the
   input: the start is never after the input, and the end is the last
   nanosecond before the next start. `Pacific/Chatham`'s 03:00 hour on its
   spring-forward begins at 03:45, and New York's repeated 1 a.m. is its own
   hour. `areZonedEqualBy`/`areUnixEqualBy` compare these boundary instants, so
   the two passes of a repeated hour are not equal. A day whose midnight repeats
   on the same date (America/Havana, 2024-11-03) is one 25-hour day.
   `getHoursInZonedDay` and `mapZonedHoursInDay` measure the input's calendar
   date via TC39 `hoursInDay`; that differs from `startOfZoned(…, "day")` only
   where a fall-back re-enters the previous date (America/Goose_Bay,
   2010-11-07).
4. **Do not pass `disambiguation` or `offset` to boundary functions.** They are
   deprecated and ignored there, matching TC39 `startOfDay()`, which takes no
   such options. Use them only on functions that set wall-clock fields —
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
10. **Calendar annotations.** GMT's zoned grammar puts `[u-ca=...]` **before**
    `[timeZone]` — the reverse of RFC 9557. Only `addZoned`, `subtractZoned`,
    `diffZoned`, `convertZonedToCalendar` and `zoned/interval/*` accept it;
    everything else rejects it and returns `""`. Always produce these with
    `convertZonedToCalendar`. The date half follows the plain grammar: a
    negative year is `-` plus six digits, and Japanese eras are `ce`, `bce`,
    then `meiji` from 1873 (see the `gmt-arithmetic` skill). `[!u-ca=…]` is
    rejected everywhere `[u-ca=…]` is.
11. **Zoned values are exact at the range limits.** In zones ahead of UTC,
    `isValidZonedDateTime("+275760-09-13T10:00:00+10:00[Australia/Sydney]")`
    is `true` and one nanosecond later is `false`. Parsing, arithmetic,
    boundaries, differences and `relativeTo` totals all work there.
    Daylight-saving rules hold to the end: `America/Santiago`'s
    `+275760-09-07` is a 23-hour day. At the first instant in a zone behind
    UTC, an offset-less wall clock (`"-271821-04-19T12:00:00[Etc/GMT+12]"`)
    resolves. The same string with its `-12:00` offset returns the sentinel,
    because TC39 checks that local date against the day range.
12. **Read the README.** This skill is a routing pointer. For the full DST
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

## References

- [README — Timezone and Calendar examples](README.md)
- [DST Disambiguation guide](https://gmt-dox.northguild.workers.dev/docs/dst-disambiguation/)
