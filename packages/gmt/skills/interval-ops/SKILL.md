---
name: interval-ops
description: >
  Interval and range math over ISO datetime/zoned/unix strings. Use
  isValid*Interval to validate start/end pairs, intervalContains* for
  point-or-interval containment, intervalsOverlap* for overlap booleans,
  intervalIntersection* / intervalUnion* for set-theoretic combine/difference
  returning { start, end } | null, intervalDifference* / intervalXor* /
  intervalAbuts* / intervalEngulfs* for set operations, and splitIntervalByUnit*
  to tile an interval by duration unit. Covers plain, zoned, unix, and utc
  namespaces. Returns false/null/[] on invalid input — never throws.
sources:
  - 'burglekitt/gmt:packages/gmt/src/plain/interval/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/interval/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/interval/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/utc/interval/index.ts'
metadata:
  type: core
  library: '@burglekitt/gmt'
  library_version: '1.9.0'
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
  splitIntervalByUnitDate,
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
| `splitIntervalByUnit*` | `(start, end, unit, amount)` | `Array<{ start, end }>` | `[]` |

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

### Split by duration unit

```ts
splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 2);
// [{ start: "2024-01-01", end: "2024-01-03" }, ..., { start: "2024-01-09", end: "2024-01-10" }]
```

The final slice is trimmed so its `end` never exceeds the original `end`.

## Return Conventions

- `boolean` families (`isValid*Interval`, `intervalContains*`, `intervalsOverlap*`, `intervalAbuts*`, `intervalEngulfs*`): `false` on invalid input.
- Object families (`intervalIntersection*`, `intervalUnion*`): `null` on no-result or invalid input.
- Array families (`intervalDifference*`, `intervalXor*`, `splitIntervalByUnit*`): `[]` on no-result or invalid input.

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

### LOW: Using `intervalContains` 3-arg for intervals

`intervalContains(start, end, innerStart)` treats the third arg as a single point. To test interval-in-interval, pass all four arguments.
