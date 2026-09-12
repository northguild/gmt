# CORE-5 — Core: Calendar boundaries and zone-aware buckets

**Scope:** ISO week dates, ordinal dates, quarter and fiscal-period boundaries, and interval bucketing anchored to a target timezone.

## Gap

Two absences with outsized consequences.

**Week and period identifiers.** Vessel schedules are published by week number, retail and manufacturing run on 52/53-week fiscal calendars, and GMT can express neither.

**Zone-aware bucketing.** "Group by day in `America/New_York`" over UTC timestamps is the most common observability bug there is — and the same operation decides how many chargeable days a container accrued, because free time is counted in terminal-local calendar days. Flooring a UTC instant to a UTC day and calling it a local day is wrong for most of the world for most of the day.

## Scope

- `packages/gmt/src/calendar/get/`:
  - `getIsoWeekDate(isoString: string): { year: number, week: number, weekday: number } | null` — ISO 8601 week date. The week-numbering year differs from the calendar year at both ends of the year.
  - `getOrdinalDate(isoString: string): { year: number, dayOfYear: number } | null` — Ordinal date, 1–366.
  - `getQuarter(isoString: string, options?: { fiscalYearStartMonth?: number }): { year: number, quarter: number } | null`
- `packages/gmt/src/calendar/get/getFiscalPeriod.ts`:
  - `getFiscalPeriod(isoString: string, calendar: { pattern: '4-5-4' | '4-4-5' | '5-4-4', yearEndsOn: string }): { year: number, period: number, week: number } | null` — Retail/fiscal period. Handles the 53-week year.
- `packages/gmt/src/calendar/calculate/`:
  - `floorToZone(isoString: string, unit: 'hour' | 'day' | 'week' | 'month', timeZone: string): string` — Floors an instant to a boundary **in the target zone**, then returns the instant at that boundary.
  - `bucketRange(start: string, end: string, unit, timeZone: string): string[]` — The boundary instants spanning a range. Buckets are not uniform in length across a DST transition, which is the point.

## Fiscal calendar variants

| Pattern | Shape | Used by |
| --- | --- | --- |
| 4-5-4 | 4, 5, 4 weeks per quarter | NRF retail calendar — the US retail standard |
| 4-4-5 | 4, 4, 5 weeks per quarter | Longer month at quarter end |
| 5-4-4 | 5, 4, 4 weeks per quarter | Longer month at quarter start |

52 × 7 = 364 days, so a 53rd week is inserted roughly every five to six years. The NRF restates a 53-week year against the following year for comparability.
([NRF 4-5-4 calendar](https://nrf.com/resources/4-5-4-calendar))

## Design notes

- A DST-transition day is 23 or 25 hours long. `bucketRange` with `unit: 'day'` must return buckets of those lengths rather than forcing 24 hours, or daily aggregates silently drift.
- `floorToZone` takes the zone explicitly. There is no implicit "local" zone — GMT has no ambient timezone and must not acquire one.
- Fiscal calendars are caller-supplied configuration, not bundled data. There is no single correct retail calendar.

## What gmt provides (do not re-implement)

- `Temporal.PlainDate.weekOfYear` / `yearOfWeek` / `dayOfYear` — the underlying ISO week and ordinal arithmetic
- `internal/intervalCountHelpers`' `getStartOfZonedUnit` — the zoned truncation `startOfZoned` and `intervalCountZoned` already share, including the DST handling a boundary instant needs
- `isValidInstant` from CORE-1's `precision/validate` — the instant grammar `floorToZone` and `bucketRange` accept
- `isValidIsoDateLike` / `isValidDate` / `isValidTimeZone` — the existing validators the six functions gate on

**No dependency on CORE-4.** The spec named `resolveLocal`, but nothing here resolves a
zoneless wall time: `floorToZone` and `bucketRange` start from an *instant* and read it into a
zone with `Temporal.Instant.prototype.toZonedDateTimeISO`, which is the opposite direction.
Local midnights that do not exist are handled by `getStartOfZonedUnit`'s truncation, not by a
disambiguation policy. Removed rather than left in place, per the epic's "dependencies are
declared, not implied" rule — see the `## Outcome` section.

## Verification

- `getIsoWeekDate('2027-01-01')` returns week-year 2026, not 2027
- `getIsoWeekDate` handles a 53-week ISO year
- `floorToZone('2024-06-15T03:00:00Z', 'day', 'America/New_York')` returns the 15 June local midnight instant, not the 15 June UTC midnight
- `bucketRange` across US spring-forward yields a 23-hour day; across fall-back, a 25-hour day
- `getFiscalPeriod` places the 53rd week correctly for a known NRF 53-week year
- Full IANA timezone coverage on `floorToZone` and `bucketRange`
- `pnpm run validate` stays green

---

## Corrections

Two things in the scope above are wrong as written. Both are recorded here so they are not
re-derived from this file later.

- **`floorToZone('2024-06-15T03:00:00Z', 'day', 'America/New_York')` returns the **14** June
  local midnight instant, not the 15th's.** `2024-06-15T03:00:00Z` is `2024-06-14T23:00` in
  New York, so the local day it falls in is 14 June and its start is `2024-06-14T04:00:00Z`
  (verified against `@js-temporal/polyfill`). The example is *better* than the verification
  bullet claimed — the UTC date reads 15 June while the local date is the 14th, which is
  exactly the failure the story exists to prevent — but the date it named was off by one.
- **The three identifier functions do not belong in `calendar/get/`.**
  `context/coding-standards.md` reserves `get/` for current-moment accessors that take no date
  value, and cites J0b, which relocated `getLocaleDayOfWeek`/`getLocaleStartOfWeek` out of
  `get/` for this exact violation. All six functions ship in `calendar/calculate/`, keeping
  the spec's names. The precedent is `plain/calculate/getDayOfYear`, `getQuarterForDate` and
  `getWeekYear` — `get`-prefixed, date-taking, and in `calculate/`.

## Outcome (delivered)

Shipped as a new `calendar/` namespace — `packages/gmt/src/calendar/calculate/` — holding all
six functions, plus three internal modules, two public type modules, the README and skill
updates and the dox registration. Decisions taken while building it:

- **`yearEndsOn` states the year-end *rule*, by example, not one year's end.** The spec types
  it `string` and says nothing more, and a bare anchor date is not enough to lay out a
  calendar: the year-end rule is "the <weekday> nearest to <month-day>", and an anchor only
  pins <weekday> plus *a* month-day within ±3 days of the target. Generating NRF's sequence
  from each of its own published year ends confirmed how sharp this is — only `2026-01-31`,
  the Saturday falling exactly on January 31, reproduces it; `2024-02-03` (a 53-week year end,
  three days off the target) states "Saturdays nearest February 3" and yields a different,
  internally consistent calendar. So `yearEndsOn` is documented as the rule stated by example,
  the JSDoc names the NRF date to pass and warns against passing an arbitrary published year
  end, and a test pins both behaviours. Inventing a rule-descriptor grammar (`"saturday-
  nearest-01-31"`) was rejected: the coding standards forbid hand-rolled string parsing, and a
  date states the same two facts with no new grammar.
- **Whether a fiscal year has 52 or 53 weeks is derived, never tabled.** It is the gap between
  that year's own two ends — 364 days or 371 — so no NRF table is bundled and the epic's
  "caller supplies the facts" rule holds. `fiscalYearEndIn` is verified against every year
  boundary the NRF publishes for 2017–2028, all three 53-week years (2017, 2023, 2028)
  included. The 53rd week is appended to period 12, where the NRF adds it ("to the end of the
  calendar"), which turns a 4-5-4 year's final quarter into 4-5-5.
- **`week` is the week of the fiscal *year*, 1–53, not of the period.** It is the numbering the
  NRF publishes, it carries strictly more information than a week-of-period given `period`,
  and it makes the story's own acceptance criterion visible in the return value: the 53rd week
  reads `{ period: 12, week: 53 }` rather than `{ period: 12, week: 5 }`.
- **`year` is the calendar year the fiscal year starts in**, for `getFiscalPeriod` and
  `getQuarter` alike — the NRF convention, where fiscal 2023 runs 2023-01-29 to 2024-02-03.
  Labelling by the end year is also common (the US federal October-start FY2025 begins in
  October 2024), so both JSDoc blocks say which one this is and that the other should add one.
  Returning both would be inventing a quantity the inputs do not carry. **`year` is therefore
  not a unique key for every rule, and the JSDoc says so with numbers.** A 364/371-day year
  drifts against the calendar, so no label drawn from a calendar year survives it for every
  anchor: under "the Saturday nearest to 31 December" two consecutive fiscal years both start
  in 2023 and collide, and 2018, 2024 and 2029 label no fiscal year at all. Labelling by the
  year a fiscal year *ends* in, or by the calendar year holding most of it, only moves the
  collision to a different anchor family (a July start, in the midpoint case) while breaking
  agreement with the NRF — the standard this story cites. So the convention stays, the limit is
  documented and tested, and a caller whose rule sits near a year boundary is told to key on the
  fiscal year's own start date, which their own `yearEndsOn` fixes.
- **The four identifier functions take a zoneless date or datetime and refuse a moment.** An
  instant has no calendar date until a zone is named, and `getIsoWeekDate("2024-06-15T12:00:00Z")`
  answering in UTC is the same class of bug as flooring a UTC instant to a UTC day. The gate is
  `isValidIsoDateLike`, so a caller who already has a local wall time need not chop it, and
  each function's JSDoc names the route for an instant (`floorToZone`, or convert in the zone
  you mean). This also keeps core rule 5 intact: every function in the namespace is plain *or*
  zoned, never both.
- **`bucketRange` is half-open `[start, end)`**, matching `intervalCountZoned`'s documented
  interval semantics, so a zero-length range mid-bucket returns one bucket and one on a
  boundary returns none — the same two cases that function calls out.
- **Truncating a wall clock is the wrong primitive for a zone-aware floor, and code review
  caught it.** The first cut floored through `internal/intervalCountHelpers`'
  `getStartOfZonedUnit` — `round({ roundingMode: "trunc" })` — which truncates the *local* time
  and then re-resolves it. When truncation lands on a local time the zone never had, Temporal's
  "compatible" disambiguation relocates it, and three bugs fell out, all confirmed against the
  polyfill before being fixed:
  - `floorToZone("2025-09-27T14:00:00Z", "hour", "Pacific/Chatham")` returned an instant
    **fifteen minutes after** its own input. Chatham springs forward 02:45 → 03:45, so local
    03:00 does not exist and resolving it moves forward. `Antarctica/Casey`'s three-hour 2020
    jump made it three hours. A function named "floor" moving forward silently mis-attributes
    events.
  - Chatham's 03:45 → 02:45 fall-back made local 02:00 and 03:00 each name two instants an
    hour and three quarters apart, and "compatible" always picks the earlier — so the second
    pass floored back over an intervening boundary.
  - `bucketRange` inherited both, and additionally *skipped* buckets shorter than their unit:
    stepping a whole unit and re-flooring steps straight over Chatham's 15-minute 03:00 hour.
    `floorToZone` and `bucketRange` then disagreed outright, which breaks the documented
    "group with one, render with the other" pairing.
  The fix replaces truncation with two primitives in `internal/zonedBucket.ts`:
  `boundaryInOwnOffset`, which measures how far into the unit the wall clock sits and subtracts
  that as *exact* time so the offset is never re-resolved; and `startsNewBucketAt`, which
  decides whether a transition opens a bucket — true when the clock lands on a unit boundary
  (New York goes back to 01:00:00, so a fall-back day really does have 25 hour buckets) or when
  the local label jumps (Chatham, and a skipped local midnight), false otherwise (Lord Howe
  goes back to 01:30, so its local 01:00 genuinely runs 90 minutes). `getStartOfZonedUnit` is
  left alone: it is `intervalCountZoned`'s, it is pre-existing, and changing it would move
  shipped counts for a story that is not about that.
- **Verified across the whole tz database, not just the battle zones.** 2,576 transition
  windows in 418 zones: no floor ever exceeds its input, every floor is idempotent, every
  `bucketRange` list is strictly increasing, and every list matches the set of distinct
  `floorToZone` values over its range. The one apparent mismatch was the probe's own 5-minute
  grid stepping over `America/Goose_Bay`'s 60-second local midnight hour — that zone changed
  DST at 00:01 — which is now a test of its own.
- **`bucketRange` caps at 10,000 boundaries and returns `[]` past it.** Temporal's range runs
  to ±273,790 years, so an unbounded hour walk over it exhausts memory; a library that crashes
  on in-range input is worse than one that returns its documented sentinel. 10,000 covers 416
  days of hours or 27 years of days, past anything rendered or aggregated in one pass, and
  keeps the worst case bounded at ~300 ms. It doubles as the `for` loop's bound, which the
  coding standards' "prefer bounded `for` loops" rule wants anyway.
- **`floorToZone` and `bucketRange` keep the spec's four units** — `hour`, `day`, `week`,
  `month` — rather than widening to every `DateTimeUnit`. Sub-hour units need no zone, and the
  year question is `getQuarter`'s and `getFiscalPeriod`'s. `ZoneBucketUnit` is exported so the
  union is nameable, and widening it is a later story's call, not a silent one.
- **A bracketed zone on `floorToZone`'s or `bucketRange`'s input is ignored, not honoured.**
  Only the instant is read; `timeZone` is what the boundary is computed in. Unlike CORE-4's
  `instant/`, no extra `[key=value]` strictness is added — an annotation cannot change which
  boundary an instant falls on, so `isValidInstant`'s grammar is taken as-is.
- **Three internal modules, not inline logic**: `fiscalCalendar.ts` (the year-end rule, the
  52/53 derivation, the period layout), `zonedBucket.ts` (the unit predicate and the stepper)
  and `zonelessCalendarDate.ts` (the shared "this is a calendar date, not a moment" gate). All
  three are unit-tested directly, including the full 52-week period layout for each of the
  three patterns and the December-anchor case where a year end lands in the previous calendar
  year.
- **Dropping `round()` also dropped a range limit.** The first cut returned the sentinel for
  the final local day of Temporal's range, because `round()` has to measure the unit it
  truncates to and `+275760-09-13`'s own end is out of range. Measuring in exact time instead
  removed that: the maximum end now floors normally in every unit. What remains is honest and
  unavoidable — the week and month containing the *first* representable instant began before
  it, so those return `""`. Both ends are pinned by tests.
- **One transcription bug the tests caught**, exactly the kind the testing standards warn
  about: a hand-copied `bucketRange` golden for Lord Howe's spring-forward dropped its first
  boundary. The expected value was wrong and the implementation was right.
