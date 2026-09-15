---
name: gmt-arithmetic
description: >
  Date arithmetic — add/subtract duration objects, diff values, clamp/closest,
  ISO 8601 duration strings, elapsed-versus-wall-clock spans, and interval range
  math. Covers the half-open [start, end) interval algebra over instants
  (intervalsOverlap, intervalContains, intersectIntervals, clampInterval,
  mergeIntervals, subtractIntervals, splitIntervalAt, sumIntervals,
  isValidInterval, Interval) versus the older closed positional interval*Date /
  *Utc / *Zoned / *Unix functions, overflow "constrain" month-end and February
  29 clamping, splitIntervalByUnit* stepping from the anchor without month-end
  drift, intervalCount* counting the same local buckets as bucketRange,
  non-ISO calendar strings (signed six-digit negative years, Japanese ce/bce/meiji
  era codes, proleptic buddhist, P30D not P1M at month ends), and the
  correct-at-the-edges guarantees at the first and last representable instant.
  Reads the installed package README.md and source JSDoc for API details; this
  skill is a routing pointer, not an API dump.
sources:
  - 'northguild/gmt:README.md'
  - 'northguild/gmt:packages/gmt/src/plain/calculate/index.ts'
  - 'northguild/gmt:packages/gmt/src/duration/index.ts'
  - 'northguild/gmt:packages/gmt/src/interval/index.ts'
  - 'northguild/gmt:packages/gmt/src/types/interval.ts'
  - 'northguild/gmt:packages/gmt/src/plain/interval/index.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/interval/index.ts'
  - 'northguild/gmt:packages/gmt/src/unix/interval/index.ts'
  - 'northguild/gmt:packages/gmt/src/utc/interval/index.ts'
  - 'northguild/gmt:packages/gmt/src/span/calculate/index.ts'
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.15.0'
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
  into n parts", "split this by month", "how much of this shift fell inside
  these windows?".
- The user is measuring elapsed time — a profile, a trace span, a sensor
  interval — and wants milliseconds or nanoseconds rather than a `Duration`.

## Core rules

1. **`add*` takes a `{ unit: number }` object, not an ISO duration string.**
   `addDate("2024-03-15", { days: 5 })` works; `addDate("2024-03-15", "P5D")`
   returns `""`. Use `diffDateAsDuration` / `addDuration` for duration strings.
2. **Arithmetic clamps; parsers reject.** `overflow` defaults to `"constrain"`,
   Temporal's default: January 31 plus one month is February 29, and
   `addDate("2024-02-29", { years: 1 })` is `"2025-02-28"`. Pass
   `{ overflow: "reject" }` to get the `""` sentinel instead of a clamp.
   `parse*` functions never clamp — `31 February` returns the sentinel.
3. **Repeated steps come from the anchor.** `splitIntervalByUnit*` computes
   boundary k as `start + k × amount`, never by stepping from the previous
   boundary, so month-end starts don't drift:
   `splitIntervalByUnitDate("2024-01-31", "2024-05-01", "month", 1)` gives
   February 29, March 31, April 30 (then a trimmed slice to May 1). A yearly
   split from February 29 returns to February 29 in leap years. Build your own
   series the same way — chaining `add*` onto the previous clamped result
   drifts to the 29th for good.
4. **Zoned counts match zoned buckets.** `intervalCountZoned`,
   `intervalCountUnix` and `intervalCountUtc` count the buckets `bucketRange`
   returns: a 20-minute range straddling `Pacific/Chatham`'s 15-minute 03:00
   hour on its spring-forward counts 2 hours, and a range over `Pacific/Apia`'s
   deleted 30 December 2011 does not count that day. `intervalCountUnix` uses
   the system time zone.
5. **Calendar units need `relativeTo`.** `durationAs`, `normalizeDuration`, and
   `compareDurations` return `null`/`""` for year/month/week arithmetic without
   a `relativeTo` anchor — a month is not a fixed length.
6. **Elapsed time and calendar distance are different questions.** `spanMs` /
   `spanNs` measure what actually elapsed; `spanWallClock(start, end, "days" |
   "hours")` measures what the clock face did. Across a DST transition they
   differ by the size of the shift — a wall-clock day is 23, 24.5 or 25 real
   hours. Reaching for the wrong one is the most common span bug there is.
7. **Span sentinels are `null`, not `0`.** `0` and `0n` are valid spans, so all
   three span functions return `null` on invalid input rather than a zero —
   `spanMs` also returns it past `Number.MAX_SAFE_INTEGER` milliseconds, where
   `spanNs` still carries the exact value as a `bigint`.
8. **Interval algebra over instants is half-open — reach for `interval/`.**
   `intervalsOverlap`, `intervalContains`, `intersectIntervals`,
   `clampInterval`, `mergeIntervals`, `subtractIntervals`, `splitIntervalAt`
   and `sumIntervals` take `Interval` records (`{ start, end }`) of instant
   strings with an offset, and treat them as `[start, end)` (SQL:2011
   `PERIOD`, RFC 5545 `DTEND`). Touching intervals do not overlap; outputs
   are the caller's own strings; `start === end` is a valid empty interval.

   ```typescript
   const shift = { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" };
   subtractIntervals(shift, [{ start: "2024-01-01T12:00:00Z", end: "2024-01-01T13:00:00Z" }]);
   // [{ start: "…T09:00:00Z", end: "…T12:00:00Z" }, { start: "…T13:00:00Z", end: "…T17:00:00Z" }]
   sumIntervals(/* that result */); // "PT7H" — hours are the largest unit, never days
   ```

   `sumIntervals` returns covered time (overlaps count once), `[]` → `"PT0S"`.
   `[]` is both a real result and the array sentinel: check inputs with
   `isValidInterval`. Plain dates, zoneless datetimes and inverted intervals
   return the sentinel — build local edges with `floorToZone` first.
9. **The positional `interval*Date|Time|DateTime|Utc|Zoned|Unix` functions are
   mostly closed `[start, end]`.** `intervalsOverlapUtc` is `true` for touching
   intervals and `intervalContainsUtc` includes `end`; `intervalAbuts*` means a
   one-unit gap (`intervalAbutsDate("2024-01-01", "2024-06-30", "2024-07-01", …)`
   is `true`, a shared endpoint is `false`); `intervalDifference*`/`intervalXor*`
   step one unit in from each cut (`…T11:59:59.999999999Z`). `intervalCount*`
   is half-open. Do not mix the two models in one computation.
10. **Calendar-annotated dates carry calendar-native digits.**
    `convertDateToCalendar` output (`"5785-01-01[u-ca=hebrew]"`) feeds
    `addDate`, `subtractDate`, `diffDate*` and the `plain/interval/*Date`
    functions. It is not RFC 9557: never pass it to `Temporal.PlainDate.from`.
    - A negative calendar year is `-` plus six digits:
      `convertDateToCalendar("1000-01-01", "taiwan")` is
      `"-000911-01-01[u-ca=taiwan]"`. `-0911` and `-000000` return the sentinel.
    - Japanese eras are the Intl Era and Month Code proposal's: `ce` up to
      1872-12-31, `bce` for ISO years ≤ 0, `meiji` from 1873-01-01 at era year
      6. Never write `;era=japanese` (a deprecated input alias of `ce`) or
      `;era=japanese-inverse` (rejected).
    - Buddhist is ISO year + 543 for every date, with no 1582 cutover.
    - A month counts only once the end date reaches the same day of the next
      month: `diffDateAsDuration("2567-08-31[u-ca=buddhist]",
      "2567-09-30[u-ca=buddhist]", "months")` is `"P30D"`, not `"P1M"`.
11. **Correct at the edges — rely on it, do not work around it.** Temporal's
    instant range is `-271821-04-20T00:00:00Z` to `+275760-09-13T00:00:00Z`,
    and GMT returns the TC39 answer up to both ends:
    - `PlainTime`'s last nanosecond stays on its day, and nothing steps past the
      last instant (`intervalAbuts*`, `intervalXorAll*`).
    - The earliest month has an end: `endOfDate("-271821-04-19", "month")` is
      `"-271821-04-30"`.
    - Every supported calendar parses and does arithmetic at both limits.
      Hebrew years ≤ 0 and Indian dates before ISO year 1 are correct.
    - `spanNs` and `sumIntervals` are exact across the whole range (up to
      `PT4800000000H`), past where a `number` stops holding nanoseconds.
    - `unix/interval` functions return the sentinel for a fractional or
      unsafe epoch, or `""`.
    - Near the maximum in `UTC`, a rounded difference or total whose window
      passes the limit returns the sentinel, exactly as `+00:00` does.
    Zoned limits are in the `gmt-timezone` skill.
12. **Read the README.** This skill is a routing pointer. For full option shapes,
   locale matrices, and code examples, read the installed package's `README.md`
   and the source JSDoc of the function you intend to call.

## Key functions

- **Point arithmetic**: `addDate`, `addDateTime`, `addTime`, `subtractTime`,
  `addBusinessDays`, `subtractBusinessDays`, `cycleDate`, `setDate`
- **Diffs**: `diffDate`, `diffDateTime`, `diffTime` (+ `diffZoned`,
  `diffUnix`, `diffUtc` in their namespaces)
- **Spans (raw numbers)**: `spanMs`, `spanNs`, `spanWallClock`, `isValidSpan`
- **Bounds**: `clampDate`, `closestDateTo`, `startOfDate`, `endOfDate`,
  `startOfQuarterForDate`, `getLocaleStartOfWeek` (zoned boundaries: see the
  `gmt-timezone` skill)
- **Durations (ISO 8601)**: `isValidDuration`, `parseDuration`, `addDuration`,
  `subtractDuration`, `normalizeDuration`, `durationAs`, `formatDuration`,
  `negateDuration`, `absDuration`, `compareDurations`, `getDurationUnit`,
  `getDurationSign`
- **Diff-to-duration bridge**: `diffDateAsDuration`,
  `diffZonedAsDuration`, `diffUnixAsDuration`, `diffUtcAsDuration`
- **Interval algebra (half-open, instants)**: `isValidInterval`,
  `intervalsOverlap`, `intervalContains`, `intersectIntervals`,
  `clampInterval`, `mergeIntervals`, `subtractIntervals`, `splitIntervalAt`,
  `sumIntervals`, type `Interval`
- **Positional intervals (closed unless stated)**: `isValidDateInterval`,
  `intervalContainsDate`, `intervalsOverlapDate`, `intervalIntersectionDate`,
  `intervalUnionDate`, `intervalDifferenceDate`, `intervalXorDate`,
  `intervalFromDurationDate`, `splitIntervalByUnitDate`, `intervalCountDate`,
  `intervalLengthDate`, `intervalDivideEquallyDate`, `mergeIntervalsDate` (each
  with `DateTime`/`Zoned`/`Unix`/`Utc` variants where the type supports it)

## Namespace selection

- `plain/*` — timezone-free dates, times, datetimes
- `zoned/*` — IANA-timezone-aware (see `gmt-timezone` skill for disambiguation)
- `unix/*` — epoch seconds/milliseconds
- `utc/*` — UTC instants (`"2024-03-15T14:30:45Z"`)
- `duration/*` — ISO 8601 duration strings
- `span/*` — elapsed and wall-clock spans as raw numbers
- `interval/*` — half-open interval algebra over instant strings

## References

- [README — Quick Start](README.md)
- [Interval algebra reference](/reference/interval)
- [Interval function reference](/reference/plain)
