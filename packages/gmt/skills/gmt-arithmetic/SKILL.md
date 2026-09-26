---
name: gmt-arithmetic
description: >
  Date arithmetic — add/subtract duration objects, diff values, clamp/closest,
  ISO 8601 duration strings, elapsed-versus-wall-clock spans, business-day
  arithmetic and interval range math. Covers the half-open [start, end) interval
  algebra over instants (intervalsOverlap, intervalContains, intersectIntervals,
  clampInterval, mergeIntervals, subtractIntervals, splitIntervalAt,
  sumIntervals, isValidInterval, Interval) and the positional interval*Date /
  *Utc / *Zoned / *Unix functions on the same rule, business calendars
  (BusinessCalendar, RollConvention, isBusinessDay, addBusinessDays,
  subtractBusinessDays, businessDaysBetween, nextBusinessDay,
  previousBusinessDay, rollDate, mergeCalendars), overflow "constrain" month-end
  clamping, splitIntervalByUnit* stepping from the anchor, maxPieces limits,
  intervalCount* matching bucketRange, RFC 9557 calendar strings, and the
  correct-at-the-edges guarantees at the first and last representable instant. A
  routing pointer, not an API dump.
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
  - 'northguild/gmt:packages/gmt/src/calendar/business/index.ts'
  - 'northguild/gmt:packages/gmt/src/types/business-calendar.ts'
  - 'northguild/gmt:packages/gmt/src/types/roll-convention.ts'
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.18.0'
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
   `addTime`/`subtractTime`/`intervalFromDurationTime` take no options: a clock
   time wraps (`addTime("23:00:00", { hours: 2 })` is `"01:00:00"`).
   `parse*` functions never clamp — `31 February` returns the sentinel.
3. **Repeated steps come from the anchor.** `splitIntervalByUnit*` computes
   boundary k as `start + k × amount`, never by stepping from the previous
   boundary, so month-end starts don't drift:
   `splitIntervalByUnitDate("2024-01-31", "2024-05-01", "month", 1)` gives
   February 29, March 31, April 30 (then a trimmed slice to May 1). A yearly
   split from February 29 returns to February 29 in leap years. Build your own
   series the same way — chaining `add*` onto the previous clamped result
   drifts to the 29th for good.
   - **Piece-building functions have a limit.** `splitIntervalByUnit*`,
     `intervalDivideEqually*`, `mapDatesInRange` and `mapZonedDatesInRange` take
     `{ maxPieces }` (a positive safe integer, default `1_000_000`) and return
     `[]` when the result would be longer. `[]` there is not "empty range": if a
     long range can legitimately exceed the default, pass a larger `maxPieces`.
     `bucketRange` has its own fixed limit of 10,000 buckets.

     ```typescript
     mapDatesInRange("0001-01-01", "9999-12-31", 1); // [] — 3,652,059 dates
     splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 2, { maxPieces: 5 }).length; // 5
     ```

   - `intervalDivideEqually*` boundaries are integers, rounded half up — exact
     nanoseconds, or the epoch arguments' own unit for `intervalDivideEquallyUnix`
     (`intervalDivideEquallyUnix(0, 100, 3)` cuts at 33 and 67) — so the pieces
     tile the range with no gap or overshoot.
4. **Zoned counts match zoned buckets.** `intervalCountZoned`,
   `intervalCountUnix` and `intervalCountUtc` count the buckets `bucketRange`
   returns: a 20-minute range straddling `Pacific/Chatham`'s 15-minute 03:00
   hour on its spring-forward counts 2 hours, and a range over `Pacific/Apia`'s
   deleted 30 December 2011 does not count that day. `intervalCountUnix` counts
   in `options.timeZone`, UTC by default (`"local"` for the system zone).
5. **Calendar units need `relativeTo`.** `durationAs`, `normalizeDuration`, and
   `compareDurations` return `null`/`""` for year/month/week arithmetic without
   a `relativeTo` anchor — a month is not a fixed length. A calendar-annotated
   `relativeTo` is read as Temporal reads it: zoned when it has a time zone
   annotation, otherwise a date, and its calendar must be a `CalendarSystem`.
   - `round*` accept singular or plural `smallestUnit` names (`"hour"` or
     `"hours"`). A `roundingMode` outside Temporal's nine returns the sentinel.
   - `diff*` with an array of units returns only the listed units, and each
     unlisted unit in between folds into the next smaller listed one:
     `diffDate("2024-01-01", "2025-03-15", ["years", "days"])` is
     `{ years: 1, days: 73 }` (January to mid-March becomes days).
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
   // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" },
   //  { start: "2024-01-01T13:00:00Z", end: "2024-01-01T17:00:00Z" }]
   sumIntervals(/* that result */); // "PT7H" — hours are the largest unit, never days
   ```

   `sumIntervals` returns covered time (overlaps count once), `[]` → `"PT0S"`.
   `[]` is both a real result and the array sentinel: check inputs with
   `isValidInterval`. Plain dates, zoneless datetimes and inverted intervals
   return the sentinel — build local edges with `floorToZone` first.
9. **The positional `interval*Date|Time|DateTime|Utc|Zoned|Unix` functions are
   half-open `[start, end)` too.** `intervalsOverlapUtc` is `false` for touching
   intervals and `intervalContainsUtc` excludes `end`; `intervalAbuts*` means
   one interval's `end` equals the other's `start`
   (`intervalAbutsDate("2024-01-01", "2024-07-01", "2024-07-01", …)` is `true`);
   `intervalDifference*`/`intervalXor*` cut exactly at the other interval's
   edges, with no one-unit step. A `Date` interval's `end` is the first day
   after the period: pass `addDate(lastDay, { days: 1 })`, never the last day.
10. **Calendar strings are RFC 9557: ISO digits plus `[u-ca=<id>]`.**
    `convertDateToCalendar("2024-10-03", "hebrew")` is
    `"2024-10-03[u-ca=hebrew]"`, exactly `Temporal.PlainDate#toString()`. It
    feeds `addDate`, `subtractDate`, `diffDate*` and the `plain/interval/*Date`
    functions, and `Temporal.PlainDate.from` reads it as the same date.
    - Ids are the canonical BCP 47 / Temporal ids, in strings and arguments:
      `iso8601`, `gregory`, `hebrew`, `islamic-civil`, `islamic-tbla`,
      `islamic-umalqura`, `japanese`, `buddhist`, `roc`, `persian`, `indian`,
      `ethiopic`, `ethioaa`, `coptic`. `gregorian`, `taiwan` and
      `islamic-tabular` return the sentinel; aliases Temporal accepts
      (`ethiopic-amete-alem`) are canonicalized. `iso8601` writes no annotation.
    - Never put calendar fields (a Hebrew year, a Japanese era) in the string,
      and never slice them out of it: read them from Temporal
      (`Temporal.PlainDate.from(s).eraYear`). `;era=` is rejected.
    - A string written before 1.16.0 (`"5785-01-01[u-ca=hebrew]"`) reads as ISO
      year 5785 with no error: regenerate stored values from their ISO dates.
    - Values naming different calendars: differences (`diffDate*`,
      `intervalCount*`, `intervalLength*`, `splitIntervalByUnit*`,
      `intervalOverlappingDays*`) return the sentinel; ordering accepts them.
    - Month arithmetic of any size in range is safe:
      `addDate("2024-01-15[u-ca=persian]", { months: 3000000 })` is
      `"+252023-12-27[u-ca=persian]"`.
    - A month counts only once the end date reaches the same day of the next
      month: `diffDateAsDuration("2024-08-31[u-ca=buddhist]",
      "2024-09-30[u-ca=buddhist]", "months")` is `"P30D"`, not `"P1M"`.
11. **Correct at the edges — rely on it, do not work around it.** Temporal's
    instant range is `-271821-04-20T00:00:00Z` to `+275760-09-13T00:00:00Z`,
    and GMT returns the TC39 answer up to both ends:
    - `PlainTime`'s last nanosecond stays on its day, and no interval boundary
      is computed past the last instant (`intervalAbuts*`, `intervalXorAll*`).
    - The earliest month has an end: `endOfDate("-271821-04-19", "month")` is
      `"-271821-04-30"`.
    - Every supported calendar parses and does arithmetic at both limits.
      Hebrew years ≤ 0 and Indian dates before ISO year 1 are correct.
    - `spanNs` and `sumIntervals` are exact across the whole range (up to
      `PT4800000000H`), past where a `number` stops holding nanoseconds.
    - `unix/interval` functions return the sentinel for a fractional or
      unsafe epoch, or `""`.
    - Rounding, week functions, splits, counts, `bucketRange` and the date
      mappers return the answer at both limits when it exists:
      `roundDate("+275760-06-15", { smallestUnit: "year", roundingMode: "floor" })`
      is `"+275760-01-01"`. Only a result past the limit is the sentinel.
    - Near the maximum in `UTC`, a rounded difference or total whose window
      passes the limit returns the sentinel, exactly as `+00:00` does.
    Zoned limits are in the `gmt-timezone` skill.
12. **Business days need a `BusinessCalendar`, and a weekend is never assumed.**
    `{ weekend: number[], holidays: string[], timeZone: string }` — `weekend` is
    ISO weekday numbers, because Saturday–Sunday is not universal (much of the
    Middle East is `[5, 6]`). `isBusinessDay`, `addBusinessDays` and
    `subtractBusinessDays` take it as an optional trailing argument, defaulting to
    Monday–Friday with no holidays; `businessDaysBetween`, `nextBusinessDay`,
    `previousBusinessDay`, `rollDate` and `mergeCalendars` require it. Holidays are
    caller-supplied — GMT bundles no holiday table on the default import path.

    ```typescript
    const nyse = { weekend: [6, 7], holidays: ["2024-07-04"], timeZone: "America/New_York" };
    addBusinessDays("2024-07-03", 1, nyse); // "2024-07-05" — skips the holiday
    businessDaysBetween("2024-07-01", "2024-07-05", nyse); // 3 — start exclusive, end inclusive
    rollDate("2024-05-31", "modifiedFollowing", nyse); // backward when forward leaves the month
    ```

    These are **local-date in, local-date out**: `calendar.timeZone` records the
    locality and is never read, so reduce an instant with `floorToZone` first.
    `nextBusinessDay`/`previousBusinessDay` are strictly after/before;
    `rollDate`'s `following`/`preceding` are on-or-after/on-or-before and leave a
    working day alone. `mergeCalendars` unions weekends and holidays, so a date
    survives only if it is a working day in every input, and returns `null` for an
    empty list. Narrow inputs with `isValidBusinessCalendar` /
    `isValidRollConvention`.
13. **Read the README.** This skill is a routing pointer. For full option shapes,
   locale matrices, and code examples, read the installed package's `README.md`
   and the source JSDoc of the function you intend to call.

## Key functions

- **Point arithmetic**: `addDate`, `addDateTime`, `addTime`, `subtractTime`,
  `addBusinessDays`, `subtractBusinessDays`, `cycleDate`, `setDate`
- **Business calendars**: `isBusinessDay`, `businessDaysBetween`,
  `nextBusinessDay`, `previousBusinessDay`, `rollDate`, `mergeCalendars`,
  `isValidBusinessCalendar`, `isValidRollConvention`
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
- **Positional intervals (half-open)**: `isValidDateInterval`,
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
- [Interval algebra reference](/reference/interval/calculate/intersectIntervals)
- [Interval guides](/guides/intervals/interval-basics/)
