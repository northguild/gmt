# Slice 7 — Operating schedule: integer days, closed-form totals

Read with [index.md](./index.md), then [zone-transitions.md](./zone-transitions.md) (the memo
this slice reads) and [holiday-days.md](./holiday-days.md) (`internal/epochDay.ts`). Story scope
part 6. Target: `operatingTimeBetween` (`Europe/London`, slice-1 schedule) 10 years ≤ 2x 1 year,
measured by `pnpm bench` (warm: repeated calls in one process, as the audit measured). Report the
first call of a process (cold) beside it: it pays the transition search once.

## Today

`walkSchedule` (`operatingSchedule.ts:714`) visits every local date. Per date it steps the day
bucket with `nextZonedBucketStart` (8 to 12 Temporal operations and a transition search) and
resolves each window edge through `resolveEdge` (`:464`): build a string, call the public
`resolveLocal`, parse its result with `Instant.from`. About 30 Temporal operations a date.
Callers: `operatingTimeBetween`, `operatingIntervals`, `recurringWindows` (via
`scheduleRunsWithin`), `nextOpenAt`, `isOpenAt` (`firstOpenInstant`), `nextCloseAt`
(`firstClosedInstant`), `addOperatingTime` (`instantAfterOpenTime`).

## A. Resolved shapes

- `ResolvedWindow` gains `fromNs` and `toNs` (bigint nanoseconds since local midnight), read from
  the `PlainTime` fields in `parseWindow`; `from`/`to` strings stay for nothing else to change.
- `overrides` becomes `Map<number, ResolvedWindow[]>` keyed by epoch day (`epochDayOfDate`), and
  `specials: Int32Array`: the sorted union of holiday days and override days.
- `windowsOn(schedule, epochDay)` keeps today's precedence: override, else none on a holiday
  (`hasEpochDay`, slice 6), else `weekly[isoWeekdayOf(epochDay)]`.

## B. `internal/offsetTimeline.ts` (new; slices 8 and 10 use it too)

```ts
/** The frame's offset as constant stretches over [fromNs, toNs]. Offsets include frame.shiftNanoseconds. */
type OffsetTimeline = { changes: bigint[]; offsets: bigint[] }; // offsets[i] holds from changes[i-1] (or fromNs) to changes[i]
export function offsetTimeline(frame: ZoneFrame, fromNs: bigint, toNs: bigint): OffsetTimeline;
export function offsetOf(timeline: OffsetTimeline, ns: bigint): bigint; // binary search
```

- Changes come from `zonedNextTransition` (`zonedWallClockOperations.ts:432`), so the D13 gate
  picks the search (with slice 5's memo) or the native method. **Always pass `until`, in chunks of
  at most the search horizon (three 366-day years)**: without it the polyfill-compatible search
  stops at its clock-based horizon and would report no change in a far-future year whose offsets
  still change (TC39 `GetNamedTimeZoneNextTransition` leaves that horizon to the implementation;
  the offsets themselves keep following the zone's rule).
- The offset after each change is read once (`offsetAt`) and kept in a per-zone map beside slice
  5's memo, with the same bounds (64 zones, 4,096 entries a zone, clear on overflow).
- A fixed-offset frame (an offset zone, `UTC`, an offset with seconds) is one stretch: no search.

## C. Wall time to instant, without strings

```ts
/** TC39 GetPossibleEpochNanoseconds, read from the timeline. */
function possibleAt(timeline: OffsetTimeline, wallNs: bigint): bigint[];
/** TC39 GetEpochNanosecondsFor; `undefined` where "reject" refuses. */
function resolveWallNs(timeline: OffsetTimeline, wallNs: bigint, disambiguation: Disambiguation): bigint | undefined;
/** TC39 GetStartOfDay: the first candidate of midnight, else the change that ends the gap. */
function startOfDayNs(timeline: OffsetTimeline, epochDay: number): bigint;
```

`wallNs` is the wall clock read as UTC (`epochDay · 86,400 s + time of day`, TC39
`GetUTCEpochNanoseconds`). `possibleAt` tests `wallNs − o` against each stretch within a day
either side and keeps those that land in their own stretch, in order. `resolveWallNs` follows
`DisambiguatePossibleEpochNanoseconds` exactly as `zonedWallClock.ts:276`–`321` does with
`offsetAt` replaced by `offsetOf`: one candidate is the answer; two give the first
(`"compatible"`, `"earlier"`) or last (`"later"`); none moves the wall clock by
`offsetOf(wallNs + 1 day) − offsetOf(wallNs − 1 day)`, back for `"earlier"`, forward otherwise.

A wall time on a date within 2 days of Temporal's first or last date keeps today's
`resolveEdge` (`PAST_LAST_INSTANT`/`BEFORE_FIRST_INSTANT` rules); nothing else calls
`resolveLocal`.

## D. The walk in epoch days

`walkSchedule` keeps its visitor contract, its settle-one-date-behind rule, its `null`
conditions and `MAX_SCHEDULE_DAYS + 2` limit. It changes how a date is reached and resolved:

- The timeline is built once per walk, over the dates the walk may reach, extended a day each
  way, and grown chunk by chunk as the walk goes (a search stops early).
- Dates are epoch days, ascending, each visited once. `bound` is `startOfDayNs(d)`. A date whose
  start equals the next date's start (a deleted date: `Pacific/Apia` 2011-12-30) is skipped, as
  `nextZonedBucketStart` skips it today. A re-entered date (`America/Goose_Bay` 2010-11-06) is
  visited once, as the `lastDate` check does today.
- `resolveDateWindows` takes epoch days and uses `resolveWallNs`; for `"reject"` its
  `unresolved` span is read `"earlier"` / `"later"` as today.
- `IntervalNanoseconds.startText`/`endText` for a window edge become lazy:
  `instantText(ns)` at the point `operatingIntervals` and `recurringWindows` emit them.
  `resolveLocal` returns `Instant#toString()` (`instant/convert/resolveLocal.ts`), so the
  strings are equal. A clipped edge still takes the range's own text.

## E. `openTimeWithin` — the closed form

```ts
/** Open time in [range.start, range.end); null exactly when scheduleRunsWithin would return null. */
export function openTimeWithin(schedule: ResolvedSchedule, range: IntervalNanoseconds, disambiguation: Disambiguation): bigint | null;
```

`operatingTimeBetween` calls it instead of summing `scheduleRunsWithin`.

1. The up-front `MAX_SCHEDULE_DAYS` refusal, unchanged.
2. A date `d` is **quiet** when one stretch, offset `o`, holds every instant from
   `(d − 2) days − o` to `(d + 3) days − o`, and `d` is more than 2 days from Temporal's limits.
   Then every wall time on `d − 1`, `d` and `d + 1` resolves to `wallNs − o` under every policy
   (one candidate), and `d`'s bucket is exactly one day. No window can be refused on a quiet date
   or reach into one from a refused edge: such an edge has a change within a day of it, which
   the 2-day margin excludes.
3. Split the range at the bucket starts of maximal blocks of quiet dates lying wholly inside it.
   Open time is additive over disjoint half-open pieces (index authority row).
4. **Pieces between blocks** (range ends, dates near changes): `scheduleRunsWithin` on the
   piece, summed; `null` from any piece is `null`.
5. **A quiet block** `[D1, D2]`: `c(d)` is the length of the union of `windowsOn(d − 1)`'s
   wrapping windows (`[0, to)`) and `windowsOn(d)`'s windows (`[from, to)`, or `[from, 1 day)`
   when wrapping), within one day. It depends only on the patterns of `d − 1` and `d`. Sum:
   whole weeks times `Σ c` over a plain week, plus the at most six leftover days, plus
   `c(d) − c_plain(weekday(d))` for each `d` in the block where `d` or `d − 1` is in `specials`
   (found by `lowerBound`). O(log S + specials in the block).

Cost: O(changes in range + specials in range + log), with the piece walks a few dates each.

## F. `addOperatingTime`

`instantAfterOpenTime` first binary-searches the latest epoch day `d` in the search's horizon
with `openTimeWithin([fromNs, startOfDayNs(d))) < amount`, then runs today's walk from
`startOfDayNs(d)` for the remainder. Equal by additivity: the answer `X` satisfies
`open[from, X) = amount`, so it lies after `startOfDayNs(d)`, and a window refused under
`"reject"` before that point makes `openTimeWithin` `null`. On `null`, walk from `fromNs` as
today. `nextOpenAt`, `nextCloseAt` and `isOpenAt` keep the walk: it stops at the first run, and
a closed date now costs an array lookup.

## Tests

Every `calendar/hours/*` and `internal/operatingSchedule` row stays green unchanged (zone
matrix, `Pacific/Apia`, `America/Goose_Bay`, offsets with seconds, all four policies). Add, with
expected instants from `zdump -v` (tz 2026c) and the `resolveLocal` JSDoc examples:

| Row | Expected |
| --- | -------- |
| `resolveWallNs`, `Europe/London` 2024-03-31T01:30 (gap) | `"earlier"` 2024-03-31T00:30:00Z; `"compatible"`, `"later"` 01:30:00Z; `"reject"` `undefined` |
| same, 2024-10-27T01:30 (repeated) | `"compatible"`, `"earlier"` 00:30:00Z; `"later"` 01:30:00Z; `"reject"` `undefined` |
| `Australia/Sydney` 2024-10-06T02:30 | `"compatible"` 2024-10-05T16:30:00Z; `"earlier"` 15:30:00Z |
| `Australia/Lord_Howe` 2024-10-06T02:15 (30-minute change) | `"compatible"` 2024-10-05T15:45:00Z; `"earlier"` 15:15:00Z |
| `startOfDayNs`, `America/Sao_Paulo` 2018-11-04 (midnight skipped) | 2018-11-04T03:00:00Z, the change |
| `operatingTimeBetween("2011-12-29T00:00:00-10:00", "2012-01-01T00:00:00+14:00")`, `Pacific/Apia`, 09:00–17:00 every day | `"PT16H"`: 2011-12-29 and 2011-12-31 at 8 h; 2011-12-30 never happened in that zone |
| `openTimeWithin` over 10 years in `Europe/London` | equals the hand sum: weeks x 39 h (Mon to Thu 8 h; Fri 7 h), minus each holiday's hours (state the arithmetic) |
| `openTimeWithin` on `UTC` and on `+05:45` | the same closed form with no piece walks; pinned by the hand-sum value rows on both zones, not by a read-count spy, because a count of `offsetNanoseconds` reads would pin how the code reads the zone, not what it returns |
| `addOperatingTime` 400 h from a Monday 09:00 in `Europe/London` | the instant worked from weeks of 39 h |
| `"reject"` with a window edge at 01:30 on 2024-03-31, London, range across it | `""`, as today |

Differential check (not a test): `operatingTimeBetween`, `operatingIntervals`,
`addOperatingTime`, `nextOpenAt`, `nextCloseAt` over 2-year ranges in `Europe/London`,
`Australia/Lord_Howe`, `Pacific/Apia` (2011), `America/Goose_Bay` (2010), `America/Sao_Paulo`
(2018), `Asia/Kolkata` and `+05:45:30`, under all four policies, with wrapping, split, holiday and
override days. Old against new, JSON diffed. A difference is a defect in the new code.

## Bench

`operatingTimeBetween.bench.ts` 1 week, 1 year, 10 years, before and after (baselines 2.69,
44.9, 408 ms). Add a cold row and an `addOperatingTime` 400 h row. The cold row clears the transition memo inside the timed function, not in setup, so every search of a timed call runs uncached.

## Done when

- `resolveLocal` and `Instant.from` are gone from `operatingSchedule.ts` except the
  Temporal-limit path; no per-date `ZonedDateTime` on a quiet date.
- 10 years ≤ 2x 1 year warm; cold reported. All hours tests green; `pnpm run validate` green.
