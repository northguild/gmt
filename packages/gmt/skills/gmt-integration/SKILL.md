---
name: gmt-integration
description: >
  Application integration patterns — stable cache keys, router/query params,
  table-sort keys, nanosecond timestamps across JSON and storage boundaries,
  foreign epoch bridges (NTP, FILETIME, .NET ticks, Excel, PostgreSQL), and
  lint package selection (ESLint, Biome, Oxlint). Reads the installed package
  README.md and lint-package READMEs for API details; this skill is a routing
  pointer, not an API dump.
sources:
  - 'northguild/gmt:README.md'
  - 'northguild/gmt:packages/gmt/src/zoned/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/precision/convert/index.ts'
  - 'northguild/gmt:packages/gmt/src/precision/format/index.ts'
  - 'northguild/gmt:packages/gmt/src/precision/calculate/index.ts'
  - 'northguild/gmt:packages/gmt/src/precision/validate/index.ts'
metadata:
  type: composition
  library: '@northguild/gmt'
  library_version: '1.15.0'
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
   convert explicitly with `convertUtcToUnix` / `convertUtcToUnixMs` rather than
   dividing/multiplying by hand.
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
   an out-of-range number.
6. **Lint packages are toolchain-specific, not mutually exclusive.** Recommend
   only the one matching the project's existing linter; do not force all three.
7. **Read the READMEs.** This skill is a routing pointer. For full integration
   guidance, read the installed package's `README.md` and the matching
   `@northguild/gmt-eslint` / `gmt-oxlint` / `gmt-biome` README.

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

## References

- [README — Install and Design Philosophy](README.md)
- [Lint Package Selection guide](/guides/integration/linting/)
- [Core Rules](/core-rules/)
