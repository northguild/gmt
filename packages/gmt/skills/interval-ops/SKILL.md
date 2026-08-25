---
name: interval-ops
description: >
  Interval and range math over ISO datetime/zoned/unix strings. Use
  isValid*Interval to validate start/end pairs, intervalContains* for
  point-or-interval containment, intervalsOverlap* for overlap booleans,
  intervalIntersection*/intervalUnion* for set-theoretic combine/difference
  returning { start, end } | null, intervalDifference*/intervalXor*/
  intervalAbuts*/intervalEngulfs* for set operations, intervalFromDuration* to
  build an interval from a point plus an ISO 8601 duration, splitIntervalByUnit*
  to tile an interval by duration unit, intervalCount* for calendar-unit
  boundaries crossed, intervalLength* for exact fractional duration in a unit,
  intervalDivideEqually* to split into n equal parts, intervalSplitAt* to split
  at arbitrary points, mergeIntervals*/intervalXorAll* as list-form
  generalizations of intervalUnion*/intervalXor*, and intervalOverlappingDays*
  for shared calendar dates between two intervals. Covers plain, zoned, unix,
  utc. Returns false/null/[] on invalid input — never throws.
sources:
  - 'burglekitt/gmt:packages/gmt/src/plain/interval/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/interval/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/interval/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/utc/interval/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/duration/validate/isValidDuration.ts'
metadata:
  type: core
  library: '@burglekitt/gmt'
  library_version: '1.14.1'
---

# Interval Operations

Use this skill when working with two-point ranges (start/end pairs) across plain, zoned, unix, or UTC values.

## Setup

```ts
import {
  isValidDateInterval,
  intervalContainsDate,
  intervalsOverlapDate,
  intervalIntersectionDate,
  intervalUnionDate,
  intervalDifferenceDate,
  intervalXorDate,
  intervalAbutsDate,
  intervalEngulfsDate,
  intervalFromDurationDate,
  splitIntervalByUnitDate,
  intervalCountDate,
  intervalLengthDate,
  intervalDivideEquallyDate,
  intervalSplitAtDate,
  mergeIntervalsDate,
  intervalXorAllDate,
  intervalOverlappingDaysDate,
} from "@burglekitt/gmt";
```

Every function has `Time`, `DateTime`, `Zoned`, `Unix`, and `Utc` siblings. Replace the suffix to match your value type.

## Function Reference

| Family | Signature | Returns | Invalid |
| --- | --- | --- | --- |
| `isValid*Interval` | `(start, end)` | `boolean` | `false` |
| `intervalContains*` | `(start, end, pointOrInnerStart, innerEnd?)` | `boolean` | `false` |
| `intervalsOverlap*` | `(aStart, aEnd, bStart, bEnd)` | `boolean` | `false` |
| `intervalIntersection*` | `(aStart, aEnd, bStart, bEnd)` | `{ start, end } \| null` | `null` |
| `intervalUnion*` | `(aStart, aEnd, bStart, bEnd)` | `{ start, end } \| null` | `null` |
| `intervalDifference*` | `(aStart, aEnd, bStart, bEnd)` | `Array<{ start, end }>` | `[]` |
| `intervalXor*` | `(aStart, aEnd, bStart, bEnd)` | `Array<{ start, end }>` | `[]` |
| `intervalAbuts*` | `(aStart, aEnd, bStart, bEnd)` | `boolean` | `false` |
| `intervalEngulfs*` | `(aStart, aEnd, bStart, bEnd)` | `boolean` | `false` |
| `intervalFromDuration*` | `(value, duration, anchor, options?)` | `{ start, end } \| null` | `null` |
| `splitIntervalByUnit*` | `(start, end, unit, amount)` | `Array<{ start, end }>` | `[]` |
| `intervalCount*` | `(start, end, unit)` | `number \| null` | `null` |
| `intervalLength*` | `(start, end, unit)` | `number \| null` (fractional) | `null` |
| `intervalDivideEqually*` | `(start, end, n)` | `Array<{ start, end }>` | `[]` |
| `intervalSplitAt*` | `(start, end, points)` | `Array<{ start, end }>` | `[]` |
| `mergeIntervals*` | `(intervals: Array<{ start, end }>)` | `Array<{ start, end }>` | `[]` |
| `intervalXorAll*` | `(intervals: Array<{ start, end }>)` | `Array<{ start, end }>` | `[]` |
| `intervalOverlappingDays*` | `(aStart, aEnd, bStart, bEnd)` — `Unix` variant takes a 5th `options?: { epochUnit?, timeZone? }` | `number \| null` | `null` (`0` when disjoint) |

`intervalOverlappingDays*` has no `Time` sibling — `PlainTime` has no calendar, so a day count is undefined for it.

`intervalContains*` supports two modes:
- 3-arg: `intervalContains(start, end, point)` — point-in-interval
- 4-arg: `intervalContains(start, end, innerStart, innerEnd)` — interval-in-interval

`intervalEngulfs*` is equivalent to `intervalContains*`'s 4-argument mode.

## Core Patterns

### Validate an interval

```ts
isValidDateInterval("2024-01-01", "2024-12-31"); // true
isValidDateInterval("2024-12-31", "2024-01-01"); // false (inverted)
isValidDateInterval("invalid", "2024-12-31");    // false
```

### Point inside interval

```ts
intervalContainsDate("2024-01-01", "2024-12-31", "2024-06-15"); // true
intervalContainsTime("09:00:00", "17:00:00", "12:00:00");       // true
```

### Interval inside interval

```ts
intervalContainsDate("2024-01-01", "2024-12-31", "2024-03-01", "2024-09-01"); // true
```

### Overlap vs adjacency

`intervalsOverlap*` returns `true` only when intervals share actual time. Adjacent intervals (one's end equals the other's start) do **not** overlap:

```ts
intervalsOverlapDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31"); // true
intervalsOverlapDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31"); // false
```

`intervalAbuts*` is the complementary check — `true` only when intervals touch at exactly one boundary with zero gap and zero overlap:

```ts
intervalAbutsDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31"); // true
intervalAbutsDate("2024-01-01", "2024-06-29", "2024-06-30", "2024-12-31"); // false (gap)
intervalAbutsDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31"); // false (overlap)
```

### Intersection and union

```ts
intervalIntersectionDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31");
// { start: "2024-04-01", end: "2024-06-30" }

intervalIntersectionDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31");
// null (disjoint)

intervalUnionDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31");
// { start: "2024-01-01", end: "2024-12-31" }

intervalUnionDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31");
// null (disjoint with gap)
```

Adjacent intervals count as overlapping for intersection and as mergeable for union.

### Set difference and symmetric difference

```ts
intervalDifferenceDate("2024-01-01", "2024-12-31", "2024-06-01", "2024-07-01");
// [{ start: "2024-01-01", end: "2024-05-31" }, { start: "2024-07-02", end: "2024-12-31" }]

intervalXorDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31");
// [{ start: "2024-01-01", end: "2024-03-31" }, { start: "2024-07-01", end: "2024-12-31" }]
```

Both return `[]` when B fully covers A or on invalid input.

### Construct an interval from a point + duration

`intervalFromDuration*` builds an interval from a single point and an ISO 8601 duration string, anchored at either end — Luxon's `Interval.after`/`Interval.before` as one function with an `anchor` param:

```ts
intervalFromDurationDate("2024-01-01", "P1M", "start");
// { start: "2024-01-01", end: "2024-02-01" }

intervalFromDurationDate("2024-02-01", "P1M", "end");
// { start: "2024-01-01", end: "2024-02-01" }

intervalFromDurationZoned(
  "2024-03-09T02:30:00-05:00[America/New_York]",
  "P1D",
  "start",
);
// { start: "2024-03-09T02:30:00-05:00[America/New_York]", end: "2024-03-10T03:30:00-04:00[America/New_York]" }
```

Calendar units (years/months/weeks) resolve against `value` itself via Temporal's `add()`/`subtract()` — no separate `relativeTo` is needed. `intervalFromDurationZoned` accepts the same `disambiguation`/`offset`/`overflow` options as `addZoned`; `intervalFromDurationUnix` accepts `addUnix`'s `epochUnit`/`timeZone`/`overflow` options. A negative `duration` that inverts the computed span returns `null`, same as any other invalid input.

`intervalFromDurationTime` is the one exception: `PlainTime` has no calendar, so a `duration` with a nonzero years/months/weeks/days component returns `null` rather than silently ignoring those fields:

```ts
intervalFromDurationTime("12:00:00", "PT1H", "start"); // { start: "12:00:00", end: "13:00:00" }
intervalFromDurationTime("12:00:00", "P1D", "start");  // null (date units need relativeTo, unsupported)
```

### Split by duration unit

```ts
splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 2);
// [{ start: "2024-01-01", end: "2024-01-03" }, ..., { start: "2024-01-09", end: "2024-01-10" }]
```

The final slice is trimmed so its `end` never exceeds the original `end`.

### Count unit boundaries crossed

```ts
intervalCountDateTime("2024-01-01T23:59:00", "2024-01-02T00:01:00", "day");
// 2 — two minutes long, but it crosses a day boundary

intervalCountDate("2024-01-01", "2024-01-03", "day"); // 2 (end boundary excluded)
intervalCountDate("2024-01-15", "2024-03-10", "month"); // 3
```

This is calendar-boundary counting, not duration. Use `diff*` when you want exact elapsed time.

### Exact interval length vs boundary count

`intervalLength*` answers "how long is this interval" as a real, possibly fractional number — `intervalCount*` answers "how many `unit` boundaries does it touch". They read as synonyms but are not:

```ts
intervalCountDateTime("2024-01-01T23:59:00", "2024-01-02T00:01:00", "day");
// 2 — touches 2 day boundaries

intervalLengthDateTime("2024-01-01T23:59:00", "2024-01-02T00:01:00", "day");
// 0.001388888888888889 — the interval is only ~2 minutes long
```

`intervalLength*` uses `Duration.prototype.total`, so calendar units (month, year) resolve against the interval's own `start` rather than truncating: `intervalLengthDate("2024-01-01", "2024-01-16", "month")` is `15/31`, not `0`. `intervalLengthZoned`/`intervalLengthUnix`/`intervalLengthUtc` are DST-aware the same way `intervalCountZoned` is — a spring-forward day is `23` hours via `intervalLengthZoned(..., "hour")` but exactly `1` via `intervalLengthZoned(..., "day")`.

### Split an interval into n equal parts

```ts
intervalDivideEquallyDate("2024-01-01", "2024-01-05", 4);
// [{ start: "2024-01-01", end: "2024-01-02" }, ..., { start: "2024-01-04", end: "2024-01-05" }]
```

`n` must be a positive integer (`n <= 0` or non-integer returns `[]`). `n === 1` returns the original interval as a single-element array. A zero-length interval returns `n` identical zero-length sub-intervals. `PlainDate` has no fractional-day representation, so `intervalDivideEquallyDate` rounds internal boundaries to the nearest whole day when the total doesn't divide evenly by `n`; every other variant computes boundaries from total elapsed nanoseconds and is exact (`intervalDivideEquallyZoned` splits by real elapsed time, so a DST-crossing interval's midpoint lands on the real midpoint, not the local-clock midpoint).

### Split an interval at arbitrary points

```ts
intervalSplitAtDate("2024-01-01", "2024-01-10", ["2024-01-07", "2024-01-03"]);
// [{ start: "2024-01-01", end: "2024-01-03" }, { start: "2024-01-03", end: "2024-01-07" }, { start: "2024-01-07", end: "2024-01-10" }]
```

Points need not be sorted — `intervalSplitAt*` sorts them internally. Points outside `[start, end]` or exactly on a boundary are dropped (they cannot introduce a new sub-interval). An empty `points` array, or one containing only out-of-range/duplicate points, returns `[{ start, end }]` — the whole interval, unsplit.

### Merge and XOR a list of intervals

`mergeIntervals*` and `intervalXorAll*` are the list-form generalizations of `intervalUnion*` and `intervalXor*`, which are pairwise only:

```ts
mergeIntervalsDate([
  { start: "2024-01-01", end: "2024-01-10" },
  { start: "2024-01-05", end: "2024-01-15" },
  { start: "2024-02-01", end: "2024-02-05" },
]);
// [{ start: "2024-01-01", end: "2024-01-15" }, { start: "2024-02-01", end: "2024-02-05" }]

intervalXorAllDate([
  { start: "2024-01-01", end: "2024-01-10" },
  { start: "2024-01-05", end: "2024-01-15" },
  { start: "2024-01-08", end: "2024-01-20" },
]);
// [{ start: "2024-01-01", end: "2024-01-04" }, { start: "2024-01-08", end: "2024-01-10" }, { start: "2024-01-16", end: "2024-01-20" }]
```

Both take a single array of `{ start, end }` records (order doesn't matter) instead of two flat 4-arg intervals. `mergeIntervals*` collapses overlapping/adjacent intervals into the minimum non-overlapping set. `intervalXorAll*` returns the set covered by an odd number of the input intervals — two identical intervals cancel out to `[]`, and for exactly two intervals the result is identical to the pairwise `intervalXor*`.

### Count shared days between two intervals

`intervalOverlappingDays*` is the numeric counterpart to `intervalIntersection*` — how many distinct calendar dates the two intervals' closed intersection touches, inclusive of both endpoints:

```ts
intervalOverlappingDaysDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31");
// 91

intervalOverlappingDaysDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31");
// 1 (adjacent, shares one date)

intervalOverlappingDaysDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31");
// 0 (disjoint — a well-defined answer, not invalid input)

intervalOverlappingDaysUnix(0, 172800000, 86400000, 259200000, { timeZone: "UTC" });
// 2
```

`intervalOverlappingDaysZoned` and `intervalOverlappingDaysUnix` count days in `aStart`'s zone (`intervalOverlappingDaysUnix` defaults to the system zone, overridable via `{ timeZone }`), same rule as `intervalCountZoned`/`intervalCountUnix` — so `intervalOverlappingDaysZoned` is not commutative when the two intervals carry different zones.

## Return Conventions

- `boolean` families (`isValid*Interval`, `intervalContains*`, `intervalsOverlap*`, `intervalAbuts*`, `intervalEngulfs*`): `false` on invalid input.
- Object families (`intervalIntersection*`, `intervalUnion*`, `intervalFromDuration*`): `null` on no-result or invalid input.
- Array families (`intervalDifference*`, `intervalXor*`, `splitIntervalByUnit*`, `intervalDivideEqually*`, `intervalSplitAt*`, `mergeIntervals*`, `intervalXorAll*`): `[]` on no-result or invalid input.
- Number families (`intervalCount*`, `intervalLength*`, `intervalOverlappingDays*`): `null` on invalid input; `intervalOverlappingDays*` additionally returns `0` for a disjoint pair (not invalid — a well-defined "zero shared days").

Never throws. Wrap in try-catch only if you need to distinguish "invalid input" from other errors.

## Namespace selection

- `plain/*` — timezone-free dates, times, or datetimes.
- `zoned/*` — IANA-timezone-aware strings (`"2024-01-01T00:00:00+00:00[UTC]"`). Rejects any `[u-ca=...]` calendar annotation (E5) — calendar-system awareness is `plain/`-only.
- `unix/*` — epoch-second numbers (returns arrays of numbers, not strings).
- `utc/*` — UTC instants (`"2024-01-01T00:00:00Z"`).

## Calendar-aware `Date` intervals (E5)

Every `Date`-suffixed function in this namespace (`intervalContainsDate`, `intervalUnionDate`, `intervalCountDate`, `splitIntervalByUnitDate`, and the rest) accepts a GMT calendar-annotated `PlainDate` string (as produced by `convertDateToCalendar`), not just bare ISO strings. The policy differs by return family:

- **Ordering/count families accept mixed calendars** — `intervalContains*`, `intervalsOverlap*`, `intervalAbuts*`, `intervalEngulfs*`, `isValidDateInterval`, `intervalOverlappingDaysDate` compare or count regardless of which calendar each argument is tagged with, since ordering and day-counting are calendar-independent.
- **Value-returning families require all arguments to share one calendar** — `intervalUnion*`, `intervalIntersection*`, `intervalDifference*`, `intervalXor*`, `intervalXorAll*`, `mergeIntervals*`, `intervalDivideEqually*`, `intervalSplitAt*` return their sentinel (`null`/`[]`) on a calendar mismatch, since there's no principled output calendar to pick for a returned date value.
- **Calendar-unit arithmetic families measure in the shared calendar, falling back to Gregorian on a mismatch** — `intervalCountDate`, `intervalLengthDate`, `splitIntervalByUnitDate`, `intervalFromDurationDate`. A Hebrew leap year crosses **13** month boundaries, not 12:

```ts
import { intervalCountDate, splitIntervalByUnitDate } from "@burglekitt/gmt";

intervalCountDate(
  "5784-01-01[u-ca=hebrew]",
  "5785-01-01[u-ca=hebrew]",
  "month",
); // 13, not 12 — Hebrew leap years insert Adar I

splitIntervalByUnitDate(
  "5784-01-01[u-ca=hebrew]",
  "5785-01-01[u-ca=hebrew]",
  "month",
  1,
).length; // 13 slices, each a real Hebrew month
```

`*DateTime`/`*Time`/`unix/*`/`utc/*` intervals are unaffected — no calendar-annotated `PlainDateTime` grammar exists, and `PlainTime` has no calendar. See `packages/gmt/README.md`'s "Calendar-aware interval and duration arithmetic" and `context/roadmap/issues/E.md`'s E5 outcome for the full per-function audit.

## Common Mistakes

### Mixing calendar systems across interval endpoints

Both `plain/` and `zoned/` interval families split by return type:

- **Ordering / counting functions accept mixed calendars** — `intervalContains*`,
  `intervalsOverlap*`, `intervalAbuts*`, `intervalEngulfs*`, `intervalOverlappingDays*`,
  `isValidDateInterval` / `isValidCalendarZonedInterval`. Ordering does not depend on calendar.
- **Value-returning set operations reject a mismatch** — `intervalUnion*`, `intervalIntersection*`,
  `intervalDifference*`, `intervalXor*`, `intervalXorAll*`, `mergeIntervals*`,
  `intervalDivideEqually*`, `intervalSplitAt*` return their sentinel (`null`/`[]`) unless every
  endpoint names the same calendar. There is no principled output calendar to pick, and four of
  them return arrays whose elements would otherwise disagree.
- **Measurement functions fall back to Gregorian** — `intervalCount*`, `intervalLength*`,
  `splitIntervalByUnit*` measure in the shared calendar when both tags match, else in
  Gregorian/ISO. They do **not** return the sentinel on a mismatch.

For `zoned/`, use `isValidCalendarZonedInterval` (not `isValidZonedInterval`, which still rejects
every `[u-ca=...]` annotation).

### Building a calendar-annotated zoned string by hand

GMT's zoned calendar grammar puts `[u-ca=...]` **before** `[timeZone]` — the reverse of RFC 9557
and of Temporal's own `toString()`:

```
5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]   // correct
5784-06-15T14:30:00-05:00[America/New_York][u-ca=hebrew]   // WRONG — silently misparses in Temporal
```

Always produce these with `convertZonedToCalendar`, never by concatenation. See the
`zoned-date-ops` skill's Common Mistakes for the full trap.

### HIGH: Confusing `intervalsOverlap` with `intervalAbuts`

Adjacent intervals (A ends where B starts) do **not** overlap. `intervalsOverlap` returns `false`; `intervalAbuts` returns `true`. They are complementary, not interchangeable.

### HIGH: Assuming `intervalEngulfs` is new logic

`intervalEngulfs(start, end, innerStart, innerEnd)` is identical to `intervalContains(start, end, innerStart, innerEnd)` with 4 arguments. Use whichever name reads better at the call site — do not implement duplicate logic.

### MEDIUM: Mutating intersection/union results

`intervalIntersection*` / `intervalUnion*` return plain `{ start, end }` records. Mutating them does not affect the original intervals (which are string inputs, not objects). Safe to treat as immutable.

### MEDIUM: Off-by-one on `splitIntervalByUnit` final slice

The last sub-interval's `end` is **trimmed** to the original `end`, not advanced by `amount × unit`. Do not assume all slices have equal length.

### HIGH: Using `intervalCount` where you meant a duration

`intervalCount*` counts calendar-unit boundaries the half-open interval `[start, end)` touches, not
elapsed time. `intervalCountDateTime("2024-01-01T23:59:00", "2024-01-02T00:01:00", "day")` is `2`
for a two-minute interval. Use `diffDateTime`/`diffUnix`/etc. for exact duration.

### MEDIUM: Expecting a zero-length interval to count 1

A zero-length interval counts `1` only when it sits mid-unit. Exactly on a boundary it counts `0` —
`intervalCountDate("2024-01-01", "2024-01-01", "month")` is `0`, while
`intervalCountDate("2024-01-15", "2024-01-15", "month")` is `1`.

### LOW: Using `intervalContains` 3-arg for intervals

`intervalContains(start, end, innerStart)` treats the third arg as a single point. To test interval-in-interval, pass all four arguments.

### HIGH: Assuming `intervalFromDurationTime` applies a calendar-unit duration

`Temporal.PlainTime.prototype.add`/`.subtract` silently discard `years`/`months`/`weeks`/`days` fields rather than throwing — `intervalFromDurationTime` guards this explicitly and returns `null` instead of producing a misleadingly zero-length interval. Only `PlainTime` has this restriction; `Date`/`DateTime`/`Utc`/`Unix`/`Zoned` all resolve calendar units against the point itself with no `relativeTo` needed.

### MEDIUM: Forgetting a negative `duration` can invert the span

`intervalFromDuration*("2024-01-05", "-P10D", "start")` computes an end before the start and returns `null`, same as any other invalid input — it does not swap the endpoints for you.

### HIGH: Expecting date-fns's `getOverlappingDaysInIntervals` number from `intervalOverlappingDays*`

date-fns's `getOverlappingDaysInIntervals` rounds up elapsed 24-hour periods; GMT's `intervalOverlappingDays*` counts inclusive calendar dates instead — they disagree at every exact-day boundary. date-fns's own doc example:

```ts
// date-fns: getOverlappingDaysInIntervals(Jan 10–20, Jan 17–21) → 3
intervalOverlappingDaysDate("2014-01-10", "2014-01-20", "2014-01-17", "2014-01-21");
// 4 — not 3
```

To reproduce date-fns's number exactly, compose `intervalIntersection*` with `intervalCount*` instead:

```ts
const span = intervalIntersectionDate(aStart, aEnd, bStart, bEnd);
span ? intervalCountDate(span.start, span.end, "day") : 0; // date-fns semantics
```

### HIGH: Confusing `intervalLength` with `intervalCount`

Same trap as above, one level deeper: `intervalLength*` and `intervalCount*` read as synonyms but answer different questions. The same interval returns different numbers from each:

```ts
intervalCountDateTime("2024-01-01T23:59:00", "2024-01-02T00:01:00", "day");  // 2  — boundaries crossed
intervalLengthDateTime("2024-01-01T23:59:00", "2024-01-02T00:01:00", "day"); // 0.0014 — exact elapsed duration
```

Use `intervalCount*` for "how many `unit`s does this span touch" (calendar-boundary counting) and `intervalLength*` for "how long is this, expressed in `unit`" (exact, possibly fractional duration).

### MEDIUM: Expecting `intervalXorAll`/`mergeIntervals` to take flat arguments like their pairwise siblings

`intervalXor*`/`intervalUnion*` take four flat string/number arguments (`aStart, aEnd, bStart, bEnd`). Their list-form generalizations `intervalXorAll*`/`mergeIntervals*` take one array of `{ start, end }` records instead, since the list can be any length. Passing flat arguments to the list form is a type error, not a runtime sentinel.
