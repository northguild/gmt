# Slice 10 — Loop sweep: every other shipped loop

Read with [index.md](./index.md), then [zone-transitions.md](./zone-transitions.md) (the memo),
[holiday-days.md](./holiday-days.md) (`internal/epochDay.ts`) and
[schedule-walk.md](./schedule-walk.md) § B (`internal/offsetTimeline.ts`), which this slice
reuses. Every existing test row stays the contract; no output changes.

## Scope and method

Every `for`, `while` and `do` loop under `packages/gmt/src`, excluding `*.test.ts`, `src/test/`
and the files slices 3–9 rework: 189 loops, 83 of them in reworked files, **106 classified here**.
Also every array method run over a generated or caller array (277 calls), every recursive
function (4 real, among 31 a name scan flagged), and every comparator or `.find`/`.includes`
callback that builds a Temporal object. Classes, from the Loop cost rule (slice 11 § A):

- **C**, bounded by a constant or a fixed table; **O**, bounded by the output's size (with a cap
  that returns the sentinel); **I**, one pass, or one sort, over the caller's own array or string;
- **G**, grows with the span (or log length, or holiday count) beyond what it returns. Fix.

Three need a fix. Measured on this branch, Node 24.21.0, mean of 5 warm runs, `Europe/London`
from `2024-01-01T00:00:00+00:00`:

| Function | 1 y | 10 y | 100 y | Answer at 100 y |
| -------- | --- | ---- | ----- | --------------- |
| `intervalCountZoned`, `"day"` | 1.53 ms | 5.45 ms | 44.7 ms | 36,524 |
| `intervalCountZoned`, `"hour"` | 1.13 ms | 5.06 ms | 47.8 ms | 876,576 |
| `intervalCountZoned`, `"month"` | 0.89 ms | 4.94 ms | 42.0 ms | 1,200 |
| `intervalOverlappingDaysZoned` (one span twice) | 1.10 ms | 4.34 ms | 41.6 ms | 36,524 |
| `dwellTime` (`calendarDays`) | 0.71 ms | 4.27 ms | 42.2 ms | 36,524 days |

The cost is linear in transitions (201 in 100 years), about 0.2 ms each. Walking the same 201
transitions with `zonedNextTransition` alone takes 37.2 ms: the D13 search, which samples the
offset every 5 days, is 85% of it, and slice 5's memo answers it on every repeat. The rest is
about 12 Temporal operations a transition, which this slice removes.

`intervalSplitAtZoned` over one year: 100 points 3.96 ms, 1,000 points 28.2 ms.

## A. `countZonedBuckets` (`internal/zonedBucket.ts:609`) — G

Callers: `intervalCountZoned`, `intervalCountUtc`, `intervalCountUnix`. Today each step finds the
next transition, then builds a `ZonedDateTime` (`withCalendar`), compares, and runs
`startsNewBucketAt` (`toPlainDateTime`, `truncateLocal`, `subtract`, two `localUnitLabel`).

**Change.** Read the transitions of `(startOfStart, startOfEnd]` from
`offsetTimeline(frame, startOfStart.epochNanoseconds, startOfEnd.epochNanoseconds,
MAX_COUNTED_TRANSITIONS - 1)`. This slice adds slice 7's optional `maxChanges`: when the range
holds more changes than that, the function returns `null` without searching further. `null` →
`null`, today's cap exactly (the loop returns null once the span holds 10,000 transitions). For each change `T` with offsets `o1`
before and `o2` after, decide in integers whether it opens a bucket, using wall
nanoseconds read as UTC (`w1 = T − 1 + o1`, `w2 = T + o2`):

| Unit | Opens a bucket at `T` when |
| ---- | -------------------------- |
| `hour` and smaller (fixed length `u`) | `w2 mod u = 0` (floor modulo), or `⌊w1 / u⌋ ≠ ⌊w2 / u⌋` |
| `day` | `⌊w1 / day⌋ ≠ ⌊w2 / day⌋` |
| `week` | the two epoch days fall in different weeks for `weekStartsOn` (ISO weekday from `isoWeekdayOf`) |
| `month`, `quarter`, `year` | the two epoch days differ **and** their labels differ: by `isoFieldsOf` in `iso8601`; otherwise build the two `PlainDate`s in the calendar and compare `localUnitLabel` |

This is `startsNewBucketAt`'s rule restated: a label change, or for sub-day units a landing on a
unit boundary; day and larger never reopen on the same label. Keep `startsNewBucketAt` as the
non-integer fallback for the non-ISO calendar row only.

At a transition that opens a bucket, and at the end, add the whole units between labels:
`⌊w / u⌋` differences for fixed-length units and weeks, `isoFieldsOf` arithmetic for ISO
months, quarters and years, today's `unitsBetween` (Temporal) only for other calendars. A
non-ISO month bucket opens only where a transition crosses a date, so that path stays rare.

`countFromBucketBeforeRange` and the `RangeError` path stay as they are.

## B. `countZonedLocalDates` (`internal/zonedLocalDates.ts:56`) — G

Callers: `intervalOverlappingDays{Zoned,Unix}`, `transport/calculate/dwellTime.ts`. Today each
step runs a transition search, a `compare`, a `subtract` and two `epochDayOf` calls
(`PlainDate.until`).

**Change.** Read `offsetTimeline(frame, start.epochNanoseconds, end.epochNanoseconds,
MAX_WALKED_TRANSITIONS)`; `null` → `null`, today's cap exactly (its `<=` loop returns null
once the span holds 10,001 transitions). Each stretch `[a, b]` (the last change before it to one nanosecond before the next,
clipped to `[start, end]`) with offset `o` touches local dates `⌊(a + o) / day⌋` to
`⌊(b + o) / day⌋`. Feed those integer pairs to the existing `unionSize`. No Temporal call after
the timeline. Delete the local `epochDayOf`; `UNIX_EPOCH_DATE` goes with it.

## C. `intervalSplitAtZoned` (`zoned/interval/intervalSplitAtZoned.ts:102`) — sort comparator

Today the comparator calls `.toInstant()` on both points: about 2·n·log₂ n `Instant`s for n
points, plus 2n in the filter and 2n in the dedupe.

**Change.** After parsing, pair each point with `epochNanoseconds` once; filter, sort and dedupe
on the bigint. `Array.prototype.sort` is stable, so equal instants keep input order and the
dedupe keeps the first, as today. No other comparator in shipped code builds a value: every
other `sort`, `halfOpen*` and `min*`/`max*` site compares values parsed up front.

## Authority

| Rule | Source |
| ---- | ------ |
| An instant's local date is `⌊(epochNs + offsetNs) / 86,400 × 10⁹⌋` days from 1970-01-01 | TC39 Temporal `GetISODateTimeFor` (`epochNs + offsetNs`, then `GetISOPartsFromEpoch`); ECMA-262 §21.4.1 `Day` |
| Wall-clock units below a day have fixed length in wall time | TC39 Temporal `RoundISODateTime`/`RoundTime` (unit lengths in `nsPerTimeUnit`, day = 24 h of wall time) |
| A bucket opens at a transition on a label change, or a landing on a sub-day unit boundary | The rule `startsNewBucketAt` documents; its existing test rows are the contract |
| ISO year, month and quarter from an epoch day | Index row (ECMA-262 `Day`; TC39 `EpochDaysToISODate`) |
| Instants compare by epoch nanoseconds | TC39 Temporal `Temporal.Instant.compare` (`CompareEpochNanoseconds`) |
| A sort keeps equal elements in input order | ECMA-262 `Array.prototype.sort` (stable since ES2019) |

## Tests

Every row in `zonedBucket.test.ts`, `intervalCount{Zoned,Utc,Unix}.test.ts`,
`intervalOverlappingDays{Zoned,Unix}.test.ts`, `dwellTime.test.ts` and
`intervalSplitAtZoned.test.ts` stays green unchanged. Add (skip one an equal row already covers):

| Row | Expected |
| --- | -------- |
| `intervalCountZoned("2024-01-01T00:00:00+00:00[Europe/London]", "2124-01-01T00:00:00+00:00[Europe/London]", "day")` | 36524 (100·365 + 24 leap days; 2100 is not leap) |
| same span, `"hour"` | 876576 (36,524 · 24: each spring gap removes one hour bucket, each fall-back adds one) |
| same span, `"month"` | 1200 |
| `intervalCountZoned("2011-12-29T00:00:00-10:00[Pacific/Apia]", "2012-01-01T00:00:00+14:00[Pacific/Apia]", "day")` | 2 (29 and 31 December; the runtime gives `2011-12-29T00:00-10:00` + 24 h = `2011-12-31T00:00+14:00`) |
| `intervalCountZoned("2024-01-01T00:00:00+00:00[Europe/London][u-ca=hebrew]", "2025-01-01T00:00:00+00:00[Europe/London][u-ca=hebrew]", "month")` | 13 (20 Tevet 5784 to 1 Tevet 5785: `PlainDate#until` gives P12M11D in a leap year; the end sits on a bucket start) |
| `intervalOverlappingDaysZoned` on the Apia span against itself | 2 |
| `dwellTime("2010-11-06T12:00:00-03:00[America/Goose_Bay]", "2010-11-07T12:00:00-04:00[America/Goose_Bay]").calendarDays` | 2 (6 November is re-entered at the 00:01 fall-back and counted once) |
| `offsetTimeline` over London 2024-01-01 to 2026-01-01, `maxChanges` 3 | `null` (four changes); with 4, the four changes |
| `intervalSplitAtZoned` with two points on the same instant in different zones | the first in input order is the boundary, as today |
| `intervalSplitAtZoned`, 1,000 points: no `toInstant` call during the sort (spy through the seam) | the same intervals |

## Bench

Rows `zonedSpans.bench.ts` (slice 1): the table above, plus 100 and 1,000 points for
`intervalSplitAtZoned`, plus a cold row with the memos cleared in `setup`. Targets: warm 100 y
≤ 0.1x before for every row in the table (the walk becomes integer work over memoised changes);
cold 100 y ≤ 1.1x the raw transition walk (37.2 ms here: the D13 search is the floor until D13
is fixed upstream); `intervalSplitAtZoned` 1,000 points ≤ 0.6x before.

## Final budgets

This is the last code slice, so its last commit sets the budgets (owner decision 2): run
`pnpm size --update` and review the diff of `scripts/bundle-size.budgets.json` against the
before snapshot ([harness.md § C](./harness.md#c-the-before-snapshot)).

## Safe loops (no change)

**C** — `internal/daylightTime.ts:51,83,93,116,211` (64 changes in a year);
`internal/fiscalCalendar.ts:108,145,180` (3 years); `internal/zonedWallClock.ts:251,356,545`
(bisection); `internal/zonedBucket.ts:374,478`; `internal/zonedWallClockDifference.ts:268,390,548,867`;
`internal/instantNanoseconds.ts:187`; `internal/httpDateFields.ts:65,66`;
`internal/leapSeconds.ts:63,108,149,198` (table rows); `internal/readDurationUnits.ts:70`;
`internal/readSetFields.ts:202`; `internal/readDateTimeFormatOptions.ts:93`;
`internal/plainFormatOptions.ts:34,45`; `internal/ediGrammar.ts:215`;
`internal/ediDateTimeFields.ts:175,244`; `intermodal/calculate/multimodalETA.ts:57`;
`transport/calculate/scheduleDelivery.ts:166,187`; `transport/calculate/bestAvailable.ts:77`;
`zoned/get/getDstTransitions.ts:100` (one year); `internal/temporalCompat/fieldSearch.ts:95`,
`hebrewArithmetic.ts:96,108,127`, `largeMonthSpan.ts:104,139`, `nonIsoArithmetic.ts:104,300,306`,
`readArithmeticModel.ts:146,213,281,289,376`, `indianArithmetic.ts:53,105`.

**O** — `calendar/calculate/bucketRange.ts:136`; `internal/splitStep.ts:126`;
`plain/interval/splitIntervalByUnitTime.ts:136`; `intervalSplitAt{Date:108,DateTime:94,Time:96,Utc:86,Unix:83,Zoned:119}`;
`intervalDivideEqually{Date:112,120,DateTime:107,119,Time:101,111,Utc:95,105,Unix:93,101,Zoned:120,132}`;
`plain/map/mapDatesInRange.ts:91`; `zoned/map/mapZonedDatesInRange.ts:106`;
`zoned/map/mapZonedHoursInDay.ts:35` (25 hours); `interval/calculate/splitIntervalAt.ts:66`.

**I** — `transport/calculate/{punctualityRate:66,bestAvailable:74,scheduleDelivery:307,nextDeparture:57}`;
`interval/calculate/{splitIntervalAt:46,subtractIntervals:53}`; `internal/timestampEvents.ts:74`;
`internal/unixEpochValue.ts:277`; `internal/halfOpenIntervals.ts:114,162,208,212`;
`internal/intervalNanoseconds.ts:69,105`; `internal/rfc5322DateTime.ts:72,92,110`;
`internal/patternToken.ts:185,199,224,296,427`; `internal/dutyRules.ts:180,332`;
`unix/interval/intervalSplitAtUnix.ts:60`; `internal/zonedLocalDates.ts:24` (the union).

**Array methods and recursion.** The `sort*`, `min*`/`max*`/`closest*`, `mergeIntervals*` and
`intervalXorAll*` helpers parse once, then compare parsed values: I. `Array.from` in
`mapDaysInMonth` (31) and `intervalDivideEqually*` (the output): C and O. `demurrageClock`'s
`only` filters twice: I. Recursion: `readArithmeticModel` `addMonths` and `monthsBetween`
(bounded by the jump back-off), `countZonedBuckets` → `countFromBucketBeforeRange` (depth 1): C.

## Done when

- The three fixes are in; every listed test row passes; the bench targets are met or the gap is
  reported with figures.
- `pnpm compat:oracle` exits 0; budgets set; `pnpm run validate` green.
