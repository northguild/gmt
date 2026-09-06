---
name: gmt-arithmetic
description: >
  Date arithmetic — add/subtract duration objects, diff values, clamp/closest,
  ISO 8601 duration strings, and interval range math (contain, overlap, union,
  split, count boundaries). Reads the installed package README.md and source
  JSDoc for API details; this skill is a routing pointer, not an API dump.
sources:
  - 'northguild/gmt:README.md'
  - 'northguild/gmt:packages/gmt/src/plain/calculate/index.ts'
  - 'northguild/gmt:packages/gmt/src/duration/index.ts'
  - 'northguild/gmt:packages/gmt/src/plain/interval/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/interval/index.ts'
  - 'northguild/gmt:packages/gmt/src/unix/interval/index.ts'
  - 'northguild/gmt:packages/gmt/src/utc/interval/index.ts'
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.14.2'
---

# GMT Arithmetic

Use this skill when the task involves adding, subtracting, diffing, clamping,
or doing range math over date/time values — including ISO 8601 duration strings
and full interval set operations.

## When to load

- The user wants to move a date forward/backward by a quantity.
- The user needs the difference between two dates as a number or a duration
  string.
- The user wants to restrict a value to a min/max range, or find the nearest
  candidate.
- The user needs range math: "do these overlap?", "merge these", "split this
  into n parts".

## Core rules

1. **`add*` takes a `{ unit: number }` object, not an ISO duration string.**
   `addDate("2024-03-15", { days: 5 })` works; `addDate("2024-03-15", "P5D")`
   returns `""`. Use `diffDateAsDuration` / `addDuration` for duration strings.
2. **`overflow`** defaults to `"constrain"` (clamps to a valid date). Pass
   `{ overflow: "reject" }` to get the `""` sentinel instead of a clamp.
3. **Calendar units need `relativeTo`.** `durationAs`, `normalizeDuration`, and
   `compareDurations` return `null`/`""` for year/month/week arithmetic without
   a `relativeTo` anchor — a month is not a fixed length.
4. **Read the README.** This skill is a routing pointer. For full option shapes,
   locale matrices, and code examples, read the installed package's `README.md`
   and the source JSDoc of the function you intend to call.

## Key functions

- **Point arithmetic**: `addDate`, `addDateTime`, `addTime`, `subtractTime`,
  `addBusinessDays`, `subtractBusinessDays`, `cycleDate`, `setDate`
- **Diffs**: `diffDate`, `diffDateTime`, `diffTime` (+ `diffZoned`,
  `diffUnix`, `diffUtc` in their namespaces)
- **Bounds**: `clampDate`, `closestDateTo`, `startOfDate`, `endOfDate`,
  `startOfQuarterForDate`, `getLocaleStartOfWeek`
- **Durations (ISO 8601)**: `isValidDuration`, `parseDuration`, `addDuration`,
  `subtractDuration`, `normalizeDuration`, `durationAs`, `formatDuration`,
  `negateDuration`, `absDuration`, `compareDurations`, `getDurationUnit`,
  `getDurationSign`
- **Diff-to-duration bridge**: `diffDateAsDuration`,
  `diffZonedAsDuration`, `diffUnixAsDuration`, `diffUtcAsDuration`
- **Intervals (range math)**: `isValidDateInterval`, `intervalContainsDate`,
  `intervalsOverlapDate`, `intervalIntersectionDate`, `intervalUnionDate`,
  `intervalDifferenceDate`, `intervalXorDate`, `intervalFromDurationDate`,
  `splitIntervalByUnitDate`, `intervalCountDate`, `intervalLengthDate`,
  `intervalDivideEquallyDate`, `mergeIntervalsDate`

## Namespace selection

- `plain/*` — timezone-free dates, times, datetimes
- `zoned/*` — IANA-timezone-aware (see `gmt-timezone` skill for disambiguation)
- `unix/*` — epoch seconds/milliseconds
- `utc/*` — UTC instants (`"2024-03-15T14:30:45Z"`)
- `duration/*` — ISO 8601 duration strings

## References

- [README — Quick Start](README.md)
- [Interval function reference](/reference/plain)
