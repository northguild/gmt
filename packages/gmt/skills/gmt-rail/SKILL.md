---
name: gmt-rail
description: >
  GTFS Schedule times in @northguild/gmt/rail — the stop_times value that runs
  past midnight (25:35:00): parseGtfsTime, formatGtfsTime, isValidGtfsTime and
  the GtfsTime type { seconds, dayOverflow }. The days past the service day are
  kept apart from the time of day, so 25:35:00 reads as 1:35 with one day of
  overflow and writes back as 25:35:00, never 01:35:00. Hours run 0 to 999.
  Reads the docs site (llms.txt) and the installed package's JSDoc; a routing
  pointer, not an API dump.
sources:
  - 'northguild/gmt:apps/dox/src/content/docs/guides/industries/rail-gtfs-service-days.mdx'
  - 'northguild/gmt:packages/gmt/src/rail/format/index.ts'
  - 'northguild/gmt:packages/gmt/src/rail/parse/index.ts'
  - 'northguild/gmt:packages/gmt/src/rail/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/types/gtfs.ts'
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.21.0'
---

# GMT Rail

Use this skill when the task is reading, writing or checking a GTFS Schedule
`Time` value, such as `arrival_time` or `departure_time` in `stop_times.txt`.
A trip that runs past midnight is written with an hour above 23 (`25:35:00`).

## When to load

- The user reads a GTFS feed and a stop time is `24:00:00` or later.
- The user asks why a parser rejects `25:35:00`, or why trips after midnight
  land on the wrong date.
- The user needs to write a GTFS time back, or check that a value is one.

## Core rules

1. **A GTFS time is not a clock reading.** `25:35:00` is 1:35 on the day after
   the service day, and it still belongs to that service day. Do not read it
   with `PlainTime` (it refuses the hour, or clamps it to `23:35:00`), and do
   not fold it into `01:35:00`: every trip after midnight then moves to the
   wrong date.
2. **The overflow is kept apart from the time.** `parseGtfsTime` returns
   `{ seconds, dayOverflow }`: the time of day in seconds (0 to 86399) and the
   whole days past the service day.
   ```typescript
   parseGtfsTime("25:35:00"); // { seconds: 5700, dayOverflow: 1 }
   parseGtfsTime("8:05:00"); // { seconds: 29100, dayOverflow: 0 }
   parseGtfsTime("110:29:00"); // { seconds: 52140, dayOverflow: 4 }
   ```
3. **Writing gives the service-day form back.**
   ```typescript
   formatGtfsTime({ seconds: 5700, dayOverflow: 1 }); // "25:35:00"
   formatGtfsTime({ seconds: 29100, dayOverflow: 0 }); // "08:05:00"
   ```
4. **Hours run 0 to 999.** GTFS states no upper bound, so the bound is GMT's:
   MobilityData's gtfs-validator reads one to three hour digits, and real feeds
   write three (VIA Rail's `110:29:00`). The parser reads one to three hour
   digits; the formatter writes at least two and refuses a total past
   `999:59:59`.
5. **Sentinels, never exceptions.** `parseGtfsTime` returns `null`,
   `formatGtfsTime` returns `""` and `isValidGtfsTime` returns `false`. That
   covers minutes or seconds past 59, a missing field, a fraction, a sign and
   a value that is not a string. Nothing is trimmed: a space, tab, newline or
   byte order mark returns the sentinel, so strip them in your CSV reader.
6. **Validate before you trust.** `isValidGtfsTime(value)` is `true` exactly
   when `parseGtfsTime` returns a value.
7. **`dayOverflow * 86400 + seconds` is not a clock reading.** GTFS measures a
   time from noon minus 12 hours of the service day, so it matches the wall
   clock only when no clock change falls between that anchor and the time. The
   rail functions name no date and read no zone; turning a GTFS time into an
   instant needs the service date and the agency's zone (planned as
   `gtfsToInstant`).
8. **Read the docs site.** This skill is a routing pointer. The map of the
   docs is `https://northguild.dev/gmt/llms.txt`, and each page has a `.md`
   twin that holds its text. The JSDoc ships in the installed package:
   `node_modules/@northguild/gmt/dist/**/*.d.ts`.

## Key functions

- **GTFS times** (`@northguild/gmt/rail`): `parseGtfsTime`, `formatGtfsTime`,
  `isValidGtfsTime`
- **Type**: `GtfsTime` is `{ seconds: number; dayOverflow: number }`

## References

- [rail reference](https://northguild.dev/gmt/reference/rail/)
- [Docs map for agents (llms.txt)](https://northguild.dev/gmt/llms.txt)
- [GMT Transport skill](../gmt-transport/SKILL.md)
