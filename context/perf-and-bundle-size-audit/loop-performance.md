# Performance audit — Part 2, loop performance

Part of [the index](../perf-and-bundle-size-audit.md).

## Part 2 — Loop performance

### What "Big O" means here

- O(1) means the cost does not change with the input.
- O(n) means it grows in step with n. Here n is days in a span, entries in a log, or
  holidays in a calendar.
- O(n²) means doubling n quadruples the cost.

A loop that walks a span one day at a time, doing Temporal work every day, is O(days). That
work is about 10–30 object builds or parses per step. A formula reaches the same answer in
O(1) or O(log n). Examples are whole weeks × business days per week, prefix sums, and a binary
search over a sorted table.

### Measured

| Function                  | Input                   |      Time | Growth                 |
| ------------------------- | ----------------------- | --------: | ---------------------- |
| `dutyViolations` (1 rule) | 7 / 90 / 180 / 365 days of log (42–2,190 entries) | 7 / 29 / 99 / 390 ms | **quadratic**: ×4 per doubling |
| `operatingTimeBetween`    | 1 week / 1 year / 10 years, `Europe/London` | 3 / 44 / 395 ms | linear, ~40 ms per year |
| `chargeableDays`          | 2-week / 2-year dwell   | 0.8 / 36 ms | linear, ~18 ms per year |
| `businessDaysBetween`     | 1 year / 30 years, 480 holidays | 3.0 / 3.0 ms | flat: all cost is holiday parsing |
| `addBusinessDays`         | 10 days no holidays / 1 y / 10 y / 30 y with 480 holidays | 0.08 / 1.7 / 1.8 / 2.8 ms | mostly holiday parsing; the span walk adds ~1 ms over 30 years |

### Findings, ranked by real-world impact

**P1 — Duty-log scan is O(N² log N). `internal/dutyEngine.ts`.**
`ruleViolations` (`:2289`) evaluates every candidate instant. `evaluateRule` (`:1109`) then
copies the log up to that instant with `clip` (`:208`, O(N)) and rebuilds and re-sorts runs with
`runsOf` (O(N log N)). It does this at `:1126`, `:1145`, `:1235`, `:1281`, `:1294`, `:959`,
`:1461` and `:1544`. `timeIn` (`:335`) adds another O(N). Only `freePeriod` uses the cached runs.
A 2-year log would take about 1.6 s per rule.
**Fix:** build per-status runs and prefix sums once per context.

- `timeIn(S, a, b)` becomes `cum_S(b) − cum_S(a)`, where `cum_S` is a binary search into the
  prefix-sum array plus the one straddling entry.
- "The log as of `at`" becomes the whole-log runs cut at `at` by binary search. Only the
  straddling run changes.
- `lastAtLeast(c)` becomes a binary search over the precomputed runs of length ≥ c.
- Drop `clip`.

The total becomes O((N + C) log N). Also:

- `candidateInstants` (`:2050`) has an R × R loop over rest runs that only `continue`s. Break
  once the gap exceeds 2 × shift.
- The forward 30-day chunks (`:2353`) rebuild candidates from the whole log each time.
- `dutyPeriods.ts:212` inserts into a sorted cache with `splice`, which is O(n) per insert at
  the front.

**P2 — Operating-hours schedule walks every local day. `internal/operatingSchedule.ts:714`.**
`walkSchedule` runs under `operatingTimeBetween`, `operatingIntervals`, `recurringWindows`,
`nextOpenAt`, `nextCloseAt` and `addOperatingTime`. Each day it computes the next day start
(8–12 Temporal ops plus a transition search). Each window edge then goes through `resolveEdge`
(`:473`), which builds a string, calls the public `resolveLocal`, and parses the result again
with `Temporal.Instant.from`. That is 5–6 Temporal parses per edge, about 30 ops per day.
**Fix:**

1. Resolve wall times straight to epoch nanoseconds, with no string round-trip, and validate
   the zone once.
2. Use a closed form inside each stretch with no offset change. With `W` = open time in one
   week:
   `total = ⌊d/7⌋·W + (open time on the leftover days) − (open time lost to holidays in range) + (override deltas in range)`.
3. `addOperatingTime`: jump `⌊remaining / W⌋` whole weeks, correct for holidays and overrides
   in the jump, then walk at most 7 days.
4. `nextOpenAt`: skip runs of closed days by holiday lookup instead of walking.

The cost becomes O(transitions + holidays in range), not O(days).

**P3 — Free-time and demurrage ledger walks one local day at a time.
`internal/freeTimeLedger.ts:321`.** `walkFreeTime` runs under `chargeableDays`,
`freeTimeExpiry` and `billingTimeline`. It does about 15 Temporal ops per day.
**Fix:**

- Between offset changes, a local day start is `epochDay × 86 400 s − offset`.
  `businessCalendar.ts` already has integer `isoFieldsOf` / `epochDayOf` to turn that into a
  date.
- Counts and expiry follow from the weekday-count formula minus holidays found by binary
  search.
- Only `chargedDates` stays O(days), because it is output. It can be emitted from integers
  without Temporal.

**P4 — Zone transition search has no cache. `internal/zonedTransitionSearch.ts:174, 196, 235`,
`internal/zoneBucketCap.ts:62`.**

- The search samples every 5 days, building a `ZonedDateTime` each time. It is active on
  polyfill 0.5.1 because the D13 probe fails.
- With no limit, a zone with no further changes scans to 3 years past `max(from, now)`. That is
  about 6,000 reads from 1950 in `Asia/Kolkata`.
- `Temporal.Now.instant()` is read on every call.
- `certainlyTouchesMoreBuckets` calls `zonedNextTransition` **without `until`**. That can mean
  about 370k builds for a yes/no pre-check.

**Fix:**

1. Pass `prefixEndNs` as `until`.
2. Keep a per-zone memo of transitions found and of intervals verified to have no change.
   P2, P3, P1's period walk and `bucketRange` then reuse it.
3. Read the clock once per public call.

**P5 — Holidays are re-parsed through Temporal on every call. `internal/businessCalendar.ts`,
`calendar/business/businessDaysBetween.ts:32`, `transport/calculate/cutoffSchedule.ts:95`,
`calendar/business/mergeCalendars.ts:67`.**

- `businessDaysBetween` parses each holiday three times per call (twice to validate, once to
  count) and compares it twice. That is the whole 3 ms in the table.
- `isBusinessEpochDay` (`businessCalendar.ts:220`) builds an ISO string for every day stepped,
  to look it up in a `Set<string>`.
- `cutoffSchedule` re-validates and re-parses the full calendar once per cutoff.
- `mergeCalendars` sorts with a comparator that parses both strings on every comparison.

**Fix:**

- Parse each holiday once, with integer arithmetic (`YYYY-MM-DD` → epoch day; validation
  already guarantees the shape), into a sorted `Int32Array` with weekend holidays removed.
- Count holidays in a range with two binary searches: O(log H).
- Resolve the calendar once and pass the resolved form to an internal core, so no public
  function calls another public function in a loop.
- For `addBusinessDays`:
  1. Jump `⌊(n − 1)/b⌋` whole weeks, where `b` is the number of business days per week.
  2. Add back the holidays that fall inside the jump.
  3. Walk at most 7 days.

  This matters less than the parsing: the measured span cost is about 1 ms over 30 years.

**P6 — `Intl.DateTimeFormat` built on every call, often twice.**

- `formatDate.ts:57/69`, `formatTime.ts:54/63`, `instantFormatOptions.ts:105/114/121` and
  `joinDateTimeConnector.ts:58/73` each build a formatter on every call.
- `getLocaleMonthNames.ts:55` and `getLocaleWeekdayNames.ts` call `toLocaleString` 12 and 7
  times, building a formatter each time.

These costs are constant per call, not span-dependent, but formatter construction is one of
the most expensive operations in `Intl`. **Fix:** a small cache keyed by locale plus resolved
options, and one formatter per name loop.

**Lower impact:**

- `isValidTimeZone` builds a `ZonedDateTime` on every call; caching the zone ids already
  validated removes it.
- `intervalDivideEqually*` formats each inner boundary twice.
- `zonedLocalDates.ts:56` uses `PlainDate.until` where integer `epochDayOf` would do.
- `leapSeconds.ts` scans its 28 rows linearly. That cost is fixed, and a binary search is
  optional.

**Already closed-form or bounded (about 185 loop sites):**

- GNSS week, rollover and pivot-era arithmetic.
- Time scales and `leapSecondsBetween`.
- Weekday and week-of-month arithmetic.
- `countZonedBuckets`, `countZonedLocalDates`, `dwellTime` and `intervalCount*`, which are
  O(transitions).
- Bisections and fixed-cap searches in `zonedWallClock*` and `temporalCompat/*`.
- Parsers, which are O(input length).
- `mapDatesInRange` and `bucketRange`, which are O(output) and anchored at `start + k·step`.

