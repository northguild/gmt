---
name: interval-ops
description: >
  Interval and range math over ISO datetime/zoned/unix strings. Use
  isValid*Interval to validate start/end pairs, intervalContains* for
  point-or-interval containment, intervalsOverlap* for overlap booleans,
  intervalIntersection* / intervalUnion* for set-theoretic combine/difference
  returning { start, end } | null, intervalDifference* / intervalXor* /
  intervalAbuts* / intervalEngulfs* for set operations, intervalFromDuration* to
  construct an interval from a single point plus an ISO 8601 duration anchored
  at "start" or "end", splitIntervalByUnit* to tile an interval by duration
  unit, intervalCount* for how many calendar-unit boundaries an interval
  crosses, and intervalOverlappingDays* for how many distinct calendar dates two
  intervals share. Covers plain, zoned, unix, and utc namespaces. Returns
  false/null/[] on invalid input — never throws.
sources:
  - 'burglekitt/gmt:packages/gmt/src/plain/interval/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/interval/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/interval/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/utc/interval/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/duration/validate/isValidDuration.ts'
metadata:
  type: core
  library: '@burglekitt/gmt'
  library_version: '1.12.0'
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
- Array families (`intervalDifference*`, `intervalXor*`, `splitIntervalByUnit*`): `[]` on no-result or invalid input.
- Number families (`intervalCount*`, `intervalOverlappingDays*`): `null` on invalid input; `intervalOverlappingDays*` additionally returns `0` for a disjoint pair (not invalid — a well-defined "zero shared days").

Never throws. Wrap in try-catch only if you need to distinguish "invalid input" from other errors.

## Namespace selection

- `plain/*` — timezone-free dates, times, or datetimes.
- `zoned/*` — IANA-timezone-aware strings (`"2024-01-01T00:00:00+00:00[UTC]"`).
- `unix/*` — epoch-second numbers (returns arrays of numbers, not strings).
- `utc/*` — UTC instants (`"2024-01-01T00:00:00Z"`).

## Common Mistakes

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
