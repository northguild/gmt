---
name: gmt-integration
description: >
  Application integration patterns — stable cache keys, router/query params,
  table-sort keys, nanosecond timestamps across JSON and storage boundaries,
  foreign epoch bridges (NTP, FILETIME, .NET ticks, Excel, PostgreSQL), TAI and
  the closed IERS leap-second table (taiMinusUtc, leapSecondsBetween,
  nextLeapSecond, isLeapSecond, toTAI, fromTAI), the six RINEX GNSS time scales
  as peers (GPS, GAL, BDT, QZS, GLO, IRN: utcToGnss, gnssToUtc) with named week
  counters and a required rolloverEra (integer, "rolling" or { notBefore }) for
  gnssWeekToUtc/utcToGnssWeek, RINEX navigation weeks (rinexWeekToUtc,
  utcToRinexWeek), and lint package selection (ESLint, Biome, Oxlint). Reads
  the docs site (llms.txt and
  each page's .md twin) and the installed package's JSDoc for API details, and
  the lint-package READMEs for lint setup; this skill is a routing pointer, not
  an API dump.
sources:
  - 'northguild/gmt:apps/dox/src/content/docs/install.mdx'
  - 'northguild/gmt:apps/dox/src/content/docs/guides/integration/app-integration.mdx'
  - 'northguild/gmt:apps/dox/src/content/docs/guides/integration/linting.mdx'
  - 'northguild/gmt:apps/dox/src/content/docs/guides/core-date-operations/nanosecond-precision.mdx'
  - 'northguild/gmt:apps/dox/src/content/docs/guides/conversion/foreign-epoch-bridges.mdx'
  - 'northguild/gmt:packages/gmt/src/zoned/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/precision/convert/index.ts'
  - 'northguild/gmt:packages/gmt/src/precision/format/index.ts'
  - 'northguild/gmt:packages/gmt/src/precision/calculate/index.ts'
  - 'northguild/gmt:packages/gmt/src/precision/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/timescale/index.ts'
  - 'northguild/gmt:packages/gmt/src/gnss/index.ts'
  - 'northguild/gmt:packages/gmt/src/types/gnss.ts'
metadata:
  type: composition
  library: '@northguild/gmt'
  library_version: '1.19.0'
---

# GMT Integration

Use this skill when integrating GMT into an application framework or choosing
which lint package to install for Date-ban enforcement.

## When to load

- The user asks about cache keys, router params, or table-sort keys for dates.
- The user wants to validate a timezone id before using it as a cache key.
- The user is moving nanosecond timestamps across a JSON wire or into a database.
- The user is reading or writing another system's epoch — NTP, Windows `FILETIME`,
  .NET ticks, an Excel day serial, or PostgreSQL's internal microseconds.
- The user needs TAI, TAI − UTC on a date, or whether a `23:59:60` was a real
  leap second.
- The user is reading satellite receiver output: a GNSS time-scale string, a
  broadcast week and time of week, or a RINEX navigation-file week.
- The user is picking an ESLint, Biome, or Oxlint plugin to ban `Date` APIs.
- The user has a lint package but not the gmt runtime (or vice versa).

## Core rules

1. **Canonical, stable representations at boundaries.** Use ISO 8601 strings or
   normalized epoch numbers for cache keys — never `Date` objects or fuzzy
   strings. Different environments must produce the same key.
2. **Validate before you key.** Always run `isValidTimeZone` on a timezone parameter
   before using it as a cache key or router param — `"Invalid/Zone"` is a sentinel
   failure, not a real zone.
3. **Pick one canonical Unix unit.** If you mix epoch seconds and milliseconds,
   convert explicitly with `convertUtcToUnix(value)` (milliseconds) /
   `convertUtcToUnix(value, { epochUnit: "seconds" })` rather than
   dividing/multiplying by hand. An `epochUnit` option must be `"seconds"` or
   `"milliseconds"` (singular accepted): any other value returns the sentinel
   instead of being read as milliseconds. `unix/` and `utc/` read zone-dependent
   fields in UTC unless you pass `timeZone` (`"local"` for the system zone); that
   holds for the `utc/` readers and converters too, such as `parseHourFromUtc` and
   `convertUtcToPlainDate`. `convertUtcToZoned` and `convertUnixToZoned` take a
   required zone and do not accept `"local"`. A
   blank epoch string is invalid, not `1970`, and `sortUnix`/`minUnix`/`maxUnix`
   skip values that are not integer epochs in Temporal's range.
4. **Nanoseconds are `bigint`, never `number`.** A `number` is exact only to
   `2^53 − 1`, which nanoseconds since the epoch passed in April 1970. Use
   `toNanoseconds` / `fromNanoseconds`, cross a JSON boundary with
   `formatNanoseconds` / `parseNanoseconds` (`JSON.stringify` throws on a raw
   `bigint`), and call `truncateNanoseconds(ns, "us" | "ms")` before writing to a
   store that holds less than nanoseconds — PostgreSQL `timestamptz` holds
   microseconds — or the read-back value will not equal what was written.
5. **Never hand-roll another system's epoch constant.** `precision/convert/` carries
   the bridges: `toNtpTimestamp` / `fromNtpTimestamp`, `toFileTime` / `fromFileTime`,
   `toDotNetTicks` / `fromDotNetTicks`, `toExcelSerial` / `fromExcelSerial`,
   `toPgMicroseconds` / `fromPgMicroseconds`. Two traps they exist to close: an NTP
   timestamp's seconds field wraps every ~136 years and carries no era, so
   `fromNtpTimestamp` needs the era passed in; and Excel's serial 60 is the phantom
   1900-02-29, a date that never existed, so it returns `""` rather than a neighbouring
   day. Each bridge rejects instants its target format cannot hold instead of returning
   an out-of-range number. More edges to know:
   - A `FILETIME` at or above `2^63` is out of range, as Windows'
     `FileTimeToSystemTime` rules, so `fromFileTime` returns `""`. That includes
     `0xFFFFFFFFFFFFFFFF`, the "do not modify" marker.
   - An all-zero NTP timestamp is both the NTP epoch and RFC 5905's "unknown or
     unsynchronized" marker. Check for `0n` yourself before trusting it as 1900.
   - .NET ticks name an instant only when `DateTimeKind` is `Utc`. `Local` and
     `Unspecified` ticks count wall-clock time.
   - `toNanoseconds` and `isValidInstant` read the offset and do not validate a
     bracketed zone annotation. One thing is read from it: an offset written to the
     minute that is the zone's sub-minute offset rounded (`-00:45[Africa/Monrovia]`)
     names the instant the zone gives.
6. **Leap seconds come from the built-in table, never a literal.** `timescale/`
   holds the IERS leap-second table as a closed record: 27 insertions, the last
   on 2016-12-31, and TAI − UTC stays 37 s for every later date, because UTC
   becomes continuous on 20 May 2027 (CGPM 2026). No function takes a table.
   ```typescript
   taiMinusUtc("2024-01-01T00:00:00Z"); // 37
   leapSecondsBetween("2000-01-01T00:00:00Z", "2024-01-01T00:00:00Z"); // 5
   isLeapSecond("2016-12-31T23:59:60Z"); // true (a table lookup)
   isLeapSecond("2024-06-15T12:34:60Z"); // false (hasSecond60 is the shape test)
   toTAI("2026-01-01T00:00:00Z"); // "2026-01-01T00:00:37 TAI"
   fromTAI("2017-01-01T00:00:36 TAI"); // "2016-12-31T23:59:60Z"
   ```
   - Before 1972-01-01 TAI − UTC was fractional, so every function returns its
     sentinel there.
   - `timescale/` and `gnss/` accept a second 60 only on a listed insertion
     day, and may return `…T23:59:60Z`. Every other GMT function rejects `:60`,
     so do not pass that result on.
   - A smeared clock never reads `23:59:60` and is up to a second off UTC
     around an insertion. GMT cannot detect smearing.
7. **The six GNSS time scales are peers, named by their RINEX 4.02 tokens.**
   `GPS`, `GAL` (Galileo), `BDT` (BeiDou), `QZS` (QZSS), `GLO` (GLONASS) and
   `IRN` (NavIC). No system is a default; each goes through the same functions,
   with the system first.
   ```typescript
   utcToGnss("GAL", "2024-01-01T00:00:00Z"); // "2024-01-01T00:00:18 GAL"
   utcToGnss("BDT", "2024-01-01T00:00:00Z"); // "2024-01-01T00:00:04 BDT"
   utcToGnss("GPS", "1980-01-06T00:00:00Z"); // "1980-01-06T00:00:00 GPS" (0 s at the epoch)
   gnssToUtc("IRN", "2024-01-01T00:00:18 IRN"); // "2024-01-01T00:00:00Z"
   ```
   - `GLO` is GLONASS time as RINEX reports it: UTC's own hours, leap seconds
     included, not UTC + 3 h. Remove the three hours from raw system time first.
   - Each system returns the sentinel before its own epoch. Offsets are nominal:
     broadcast nanosecond corrections are not applied.
8. **A broadcast week needs its counter and its era.** `GnssWeekCounter` names
   one counter with one modulus: `"GPS-LNAV"`, `"QZS-LNAV"`, `"IRN-LNAV"` 1024
   weeks; `"GAL"` 4096; `"GPS-CNAV"`, `"QZS-CNAV"`, `"BDT"`, `"IRN-L1NV"` 8192.
   GLONASS has no week counter. `rolloverEra` is required: an integer era for
   stored data, `"rolling"` for live output (the era within half a counter
   period of today, so it reads the clock), or `{ notBefore }`, the earliest
   match at or after an instant you state, such as a firmware build date.
   ```typescript
   gnssWeekToUtc("GPS-LNAV", 100, 0, 0); // "1981-12-05T23:59:59Z"
   gnssWeekToUtc("GPS-LNAV", 100, 0, 1); // "2001-07-21T23:59:47Z"
   gnssWeekToUtc("GPS-LNAV", 1020, 0, { notBefore: "2019-04-07T00:00:00Z" }); // "2038-10-23T23:59:42Z"
   utcToGnssWeek("GAL", "2019-04-07T00:00:00Z"); // { week: 1024, timeOfWeekSeconds: 18, era: 0 }
   ```
   A RINEX navigation record's week is continuous and never wraps: read it with
   `rinexWeekToUtc` / `utcToRinexWeek`, not the broadcast functions. A RINEX
   NavIC week read as a broadcast week is 1024 weeks off.
   ```typescript
   rinexWeekToUtc("IRN", 2295, 86418); // "2024-01-01T00:00:00Z"
   gnssWeekToUtc("IRN-L1NV", 2295, 86418, 0); // "2043-08-17T00:00:00Z" (not the same week)
   ```
9. **Lint packages are toolchain-specific, not mutually exclusive.** Recommend
   only the one matching the project's existing linter; do not force all three.
10. **Read the docs site and the lint README.** This skill is a routing pointer.
   For full integration guidance, read these:
   - `https://gmt-dox.northguild.workers.dev/llms.txt` is the map of every docs page.
   - Each page has a `.md` twin that holds its text, for example
     `https://gmt-dox.northguild.workers.dev/guides/integration/app-integration.md`.
   - The JSDoc ships in the installed package:
     `node_modules/@northguild/gmt/dist/**/*.d.ts`.
   - For lint setup, read the matching `@northguild/gmt-eslint` / `gmt-oxlint` /
     `gmt-biome` README.

## Lint package selection

| Current lint stack | Recommend |
| --- | --- |
| ESLint | `@northguild/gmt-eslint` |
| Biome | `@northguild/gmt-biome` |
| Oxlint | `@northguild/gmt-oxlint` |
| No linter yet | Add one of the above; install `@northguild/gmt` first |

These can be used individually or together. If the project has a lint package
but no `@northguild/gmt`, suggest adding gmt to support safe Date-to-Temporal
refactors. Lint findings should point toward existing gmt methods first; only
suggest a new Temporal custom method (and an issue) when no gmt helper covers
the pattern.

## Integration guidance

- **Query/cache keys**: `['events', { start: '2024-02-29', end: '2024-03-01' }]`
  — ISO strings, validated.
- **Router params**: validate with `isValidDate` / `isValidTimeZone` before use.
- **Table sorting**: use ISO strings as sort keys for consistent ordering.
- **State management**: canonicalized strings/numbers at boundaries only.
- **High-precision timestamps**: keep `bigint` nanoseconds internally, send the
  decimal string from `formatNanoseconds` over the wire, and truncate to the
  target column's precision before persisting.
- **Foreign epochs at the boundary**: convert on the way in and on the way out with
  the `precision/convert/` bridges, and keep ISO strings or `bigint` nanoseconds
  everywhere in between — never carry another system's serial through your own code.
- **Satellite and atomic time at the boundary**: convert a TAI or GNSS label to a
  UTC instant on the way in (`fromTAI`, `gnssToUtc`, `gnssWeekToUtc`,
  `rinexWeekToUtc`), and back on the way out. Store the era rule you used with
  any week you decode.

## Key functions

- **Leap seconds and TAI** (`@northguild/gmt/timescale`): `taiMinusUtc`,
  `leapSecondsBetween`, `nextLeapSecond`, `isLeapSecond`, `toTAI`, `fromTAI`
- **GNSS time scales** (`@northguild/gmt/gnss`): `utcToGnss`, `gnssToUtc`,
  `gnssWeekToUtc`, `utcToGnssWeek`, `rinexWeekToUtc`, `utcToRinexWeek`, types
  `GnssSystem`, `GnssWeekCounter`, `RolloverEra`, `GnssWeek`,
  `RinexWeekSystem`, `RinexWeek`

## References

- [Docs map for agents (llms.txt)](https://gmt-dox.northguild.workers.dev/llms.txt)
- [Install](https://gmt-dox.northguild.workers.dev/install/)
- [App integration guide](https://gmt-dox.northguild.workers.dev/guides/integration/app-integration/)
- [Nanosecond precision guide](https://gmt-dox.northguild.workers.dev/guides/core-date-operations/nanosecond-precision/)
- [Foreign epoch bridges guide](https://gmt-dox.northguild.workers.dev/guides/conversion/foreign-epoch-bridges/)
- [timescale reference](https://gmt-dox.northguild.workers.dev/reference/timescale/)
- [gnss reference](https://gmt-dox.northguild.workers.dev/reference/gnss/)
- [Lint Package Selection guide](/guides/integration/linting/)
- [Core Rules](/core-rules/)
