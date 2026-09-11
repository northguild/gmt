---
name: gmt-timezone
description: >
  Timezone-aware operations — get zoned now, format zoned datetimes/ranges,
  convert between plain↔zoned↔UTC↔Unix, DST disambiguation control on
  construction and arithmetic, the instant-plus-offset pair, classifying a
  zoneless wall time before resolving it, and flooring or bucketing instants on
  local calendar boundaries. Reads the installed package README.md and source
  JSDoc for API details; this skill is a routing pointer, not an API dump.
sources:
  - 'northguild/gmt:README.md'
  - 'northguild/gmt:packages/gmt/src/zoned/get/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/format/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/compare/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/convert/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/calculate/addZoned.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/calculate/startOfZoned.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/calculate/clampZoned.ts'
  - 'northguild/gmt:packages/gmt/src/unix/get/index.ts'
  - 'northguild/gmt:packages/gmt/src/utc/get/index.ts'
  - 'northguild/gmt:packages/gmt/src/utc/convert/index.ts'
  - 'northguild/gmt:packages/gmt/src/instant/convert/index.ts'
  - 'northguild/gmt:packages/gmt/src/calendar/calculate/index.ts'
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
- The user is grouping or aggregating UTC timestamps by local day, hour, week or
  month — an observability rollup, a chargeable-days count.

## Core rules

1. **Use IANA timezone ids, not raw offsets.** `"2024-03-15T14:30:45[America/New_York]"`
   is correct; bare `"-05:00"` loses the zone and can't observe DST rules.
2. **DST disambiguation.** `convertPlainDateTimeToZoned`, `addZoned`, `startOfZoned`,
   and `setZoned` accept `disambiguation` (`"compatible"` | `"earlier"` |
   `"later"` | `"reject"`) for gap/overlap resolution. It only affects fall-back
   overlaps, **not** spring-forward gaps — use `convertPlainDateTimeToZoned`
   with `"reject"` for gap-safety.
3. **The `offset` parameter.** Defaults to `"ignore"` so `disambiguation` takes
   effect. Passing `offset: "prefer"` keeps the source offset and silently
   disables `disambiguation` — leave it at default unless you need Temporal's
   raw `.with()` semantics.
4. **Classify a zoneless wall time before resolving it.** `classifyLocal(local,
   zone)` returns `"unique"` | `"ambiguous"` | `"nonexistent"` so code can branch
   rather than accept a policy — 01:30 happens twice on a fall-back day and never
   on a spring-forward one. `resolveLocal(local, zone, { disambiguation })` then
   returns the instant, exact to the nanosecond, or `""` under `"reject"`. Reach
   for `convertPlainDateTimeToZoned` instead when you want the zoned string.
5. **An offset is not a zone.** `-05:00` does not identify `America/New_York`.
   `toOffsetInstant` splits a timestamp into `{ instant, offset, timeZone? }` —
   the shape EPCIS 2.0, EDIFACT DTM and DICOM all exchange, because the instant
   orders events and the offset renders them where they happened, and neither
   derives from the other. Keep the zone for what is still to be scheduled.
6. **Bucket in the zone, not in UTC.** `floorToZone(instant, unit, zone)` and
   `bucketRange(start, end, unit, zone)` floor on the zone's own calendar
   boundaries. Flooring a UTC instant to a UTC day and calling it a local day is
   wrong for most of the world for most of the day. The buckets are deliberately
   not uniform: a day that springs forward is 23 hours and one that falls back is
   25, and forcing 24 is what makes a daily aggregate drift.
7. **Calendar annotations.** GMT's zoned grammar puts `[u-ca=...]` **before**
   `[timeZone]` — the reverse of RFC 9557. Only `addZoned`, `subtractZoned`,
   `diffZoned`, and `convertZonedToCalendar` accept it; everything else rejects
   it and returns `""`. Always produce these with `convertZonedToCalendar`.
8. **Read the README.** This skill is a routing pointer. For the full DST
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
  `closestZonedTo`, `startOfZoned`, `endOfZoned`, `startOfQuarterForZoned`,
  `setZoned`, `cycleZoned`, `mapZonedHoursInDay`, `getHoursInZonedDay`
- **Offset/DST reads**: `getZonedOffset`, `getZonedOffsetAs`,
  `getTimeZoneOffset`, `parseTimezoneFromZoned`
- **Offset-preserving instants**: `toOffsetInstant`, `fromOffsetInstant`
- **Local-time resolution**: `classifyLocal`, `resolveLocal`
- **Zone-aware buckets**: `floorToZone`, `bucketRange`

## References

- [README — Timezone and Calendar examples](README.md)
- [DST Disambiguation guide](https://gmt-dox.northguild.workers.dev/docs/dst-disambiguation/)
