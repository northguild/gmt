### B1 — Valid Intervals

**GitHub Issue:** #32

**Title:**

```
B1 Add isValidDateInterval, isValidTimeInterval, isValidDateTimeInterval, isValidUtcInterval, isValidUnixInterval, isValidZonedInterval
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group B, item B1. Foundation for B2–B6.

## Gap
Luxon's `Interval` class validates start/end pairs. GMT has no interval/range type at all — only scalar `isBetween*` checks (`plain/compare/isBetweenDate.ts` etc.).

## Scope
One validator per Temporal environment, each accepting `(start: string, end: string): boolean`:
- `plain/interval/isValidDateInterval.ts` → `isValidDateInterval`
- `plain/interval/isValidTimeInterval.ts` → `isValidTimeInterval`
- `plain/interval/isValidDateTimeInterval.ts` → `isValidDateTimeInterval`
- `utc/interval/isValidUtcInterval.ts` → `isValidUtcInterval`
- `unix/interval/isValidUnixInterval.ts` → `isValidUnixInterval`
- `zoned/interval/isValidZonedInterval.ts` → `isValidZonedInterval`
Each function returns `true` only when both inputs parse successfully and `start <= end`; invalid input returns `false` (never throws).
Implementation pattern: regex/typeof kind detection → single Temporal parse → single `.compare()`.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: `plain/validate/isValidDateRange.ts` — check whether it already covers this before building new.

## Definition of done
Tests (valid pairs, invalid pairs, boundary equal-case, malformed input → false), JSDoc with `@example` for each environment, per-namespace `interval/` barrel exports, root `interval/` barrel export, `packages/gmt/README.md` update, changeset, lint/test pass — per `context/coding-standards.md` / `context/testing-standards.md` / `context/jsdoc-standards.md`.
```

### B2 — `intervalContains`

**GitHub Issue:** #33

**Title:**

```
B2 Add intervalContainsDate, intervalContainsTime, intervalContainsDateTime, intervalContainsUtc, intervalContainsUnix, intervalContainsZoned
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group B, item B2. Depends on B1.

## Gap
Luxon's `Interval.contains` checks whether a point or another interval falls fully within an interval. GMT has no equivalent — only scalar `isBetween*` checks that test a single point against a range.

## Scope
One function per Temporal environment. Each supports two modes via optional fourth argument:
- `intervalContains(intervalStart: string, intervalEnd: string, pointOrStart: string, pointEnd?: string): boolean`
  - 3-argument mode: `intervalContains(start, end, point)` — point-in-interval, equivalent to `start <= point <= end`
  - 4-argument mode: `intervalContains(start, end, innerStart, innerEnd)` — interval-in-interval, true only when both endpoints of the inner interval fall within the outer interval
Environment variants:
- `plain/interval/intervalContainsDate.ts` → `intervalContainsDate`
- `plain/interval/intervalContainsTime.ts` → `intervalContainsTime`
- `plain/interval/intervalContainsDateTime.ts` → `intervalContainsDateTime`
- `utc/interval/intervalContainsUtc.ts` → `intervalContainsUtc`
- `unix/interval/intervalContainsUnix.ts` → `intervalContainsUnix`
- `zoned/interval/intervalContainsZoned.ts` → `intervalContainsZoned`
Implementation pattern: regex/typeof kind detection → single Temporal parse per value → `.compare()` for boundary checks.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: `plain/compare/isBetweenDate.ts` — examine how it handles inclusive/exclusive boundaries and apply the same logic here. Note: GMT currently has no `isBetweenTime` / `isBetweenDateTime` in `plain/compare/`; this story may require adding them as implementation internals.

## Definition of done
Tests (point-in-interval, interval-in-interval, boundary inclusive/exclusive, invalid input sentinel returns), JSDoc with `@example` for both modes per environment, barrel exports for each environment's `interval/` directory, `packages/gmt/README.md` update, changeset, lint/test pass.
```

### B3 — `intervalsOverlap`

**GitHub Issue:** #34

**Title:**

```
B3 Add intervalsOverlapDate, intervalsOverlapTime, intervalsOverlapDateTime, intervalsOverlapUtc, intervalsOverlapUnix, intervalsOverlapZoned
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group B, item B3. Depends on B1.

## Gap
Luxon's `Interval.overlaps` checks whether two intervals share any time. GMT has no equivalent — only scalar comparisons and the B1 validators.

## Scope
One function per Temporal environment. Each accepts two intervals and returns whether they share any time:
- `intervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean`
  - Returns `true` when intervals share at least one instant.
  - Returns `false` when they are disjoint (including adjacent-but-not-overlapping).
Environment variants:
- `plain/interval/intervalsOverlapDate.ts` → `intervalsOverlapDate`
- `plain/interval/intervalsOverlapTime.ts` → `intervalsOverlapTime`
- `plain/interval/intervalsOverlapDateTime.ts` → `intervalsOverlapDateTime`
- `utc/interval/intervalsOverlapUtc.ts` → `intervalsOverlapUtc`
- `unix/interval/intervalsOverlapUnix.ts` → `intervalsOverlapUnix`
- `zoned/interval/intervalsOverlapZoned.ts` → `intervalsOverlapZoned`
Implementation pattern: regex/typeof kind detection → parse both intervals → compare endpoints (`aEnd < bStart || bEnd < aStart` → false, else true).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: `plain/compare/isBetweenDate.ts` (endpoint comparison logic). This story also informs B4's overlap detection path.

## Definition of done
Tests (adjacent-but-not-overlapping → false, fully-contained → true, partial-overlap → true, invalid input sentinel returns), JSDoc with `@example` for each environment, barrel exports for each environment's `interval/` directory, `packages/gmt/README.md` update, changeset, lint/test pass.
```

### B4 — `intervalIntersection`

**GitHub Issue:** #35

**Title:**

```
B4 Add intervalIntersectionDate, intervalIntersectionTime, intervalIntersectionDateTime, intervalIntersectionUtc, intervalIntersectionUnix, intervalIntersectionZoned
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group B, item B4. Depends on B1, B3.

## Gap
Luxon's `Interval.intersection` returns the overlapping sub-interval of two intervals. GMT has no equivalent. This is also the first story to return an object from an interval function, so it establishes the return-shape convention that B5 and B6 will follow.

## Scope
One function per Temporal environment. Each accepts two intervals and returns the overlapping span or null:
- `intervalIntersection(aStart: string, aEnd: string, bStart: string, bEnd: string): { start: string; end: string } | null`
  - Returns `{ start, end }` when intervals overlap.
  - Returns `null` when they do not overlap.
Return-shape convention: object-returning functions return a plain `{ start: string; end: string }` record on success, and `null` on no-result / invalid input (do NOT throw; invalid input is caught and returned as `null`).
Environment variants:
- `plain/interval/intervalIntersectionDate.ts` → `intervalIntersectionDate`
- `plain/interval/intervalIntersectionTime.ts` → `intervalIntersectionTime`
- `plain/interval/intervalIntersectionDateTime.ts` → `intervalIntersectionDateTime`
- `utc/interval/intervalIntersectionUtc.ts` → `intervalIntersectionUtc`
- `unix/interval/intervalIntersectionUnix.ts` → `intervalIntersectionUnix`
- `zoned/interval/intervalIntersectionZoned.ts` → `intervalIntersectionZoned`
Implementation pattern: reuse B3's overlap-detection logic; when overlapping, compute `start = max(aStart, bStart)` and `end = min(aEnd, bEnd)`.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: `plain/compare/isBetweenDate.ts` (endpoint comparison). Document the `{ start, end } | null` return convention in JSDoc so B5/B6 can reference it.

## Definition of done
Tests (no-overlap → null, full-overlap → identical bounds, partial-overlap → trimmed bounds, invalid input → null), JSDoc with `@example` for each environment documenting the return convention, barrel exports for each environment's `interval/` directory, `packages/gmt/README.md` update, changeset, lint/test pass.
```

### B5 — Interval Unions

**GitHub Issue:** #36

**Title:**

```
B5 Add intervalUnionDate, intervalUnionTime, intervalUnionDateTime, intervalUnionUtc, intervalUnionUnix, intervalUnionZoned
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group B, item B5. Depends on B1, B4 (reuse the object-return convention established there).

## Gap
Luxon's `Interval.union` returns the combined span of two overlapping or adjacent intervals. GMT has no equivalent.

## Scope
One function per Temporal environment. Each accepts two intervals and returns the combined span or null:
- `intervalUnion(aStart: string, aEnd: string, bStart: string, bEnd: string): { start: string; end: string } | null`
  - Returns `{ start, end }` when intervals overlap or are directly adjacent (`aEnd === bStart` or `bEnd === aStart`).
  - Returns `null` when intervals are disjoint with a gap between them.
  - Invalid / unparseable input also returns `null`.
Return-shape convention: follows B4's `{ start: string; end: string } | null` pattern.
Environment variants:
- `plain/interval/intervalUnionDate.ts` → `intervalUnionDate`
- `plain/interval/intervalUnionTime.ts` → `intervalUnionTime`
- `plain/interval/intervalUnionDateTime.ts` → `intervalUnionDateTime`
- `utc/interval/intervalUnionUtc.ts` → `intervalUnionUtc`
- `unix/interval/intervalUnionUnix.ts` → `intervalUnionUnix`
- `zoned/interval/intervalUnionZoned.ts` → `intervalUnionZoned`
Implementation pattern: detect overlap/adjacency → return `{ start: min(aStart,bStart), end: max(aEnd,bEnd) }` or `null`.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: B4's `intervalIntersection*` (reuse the `{ start, end } | null` return convention and the endpoint-comparison logic).

## Definition of done
Tests (overlapping → merged bounds, adjacent → merged bounds, disjoint-with-gap → null, invalid input → null), JSDoc with `@example` for each environment documenting the return convention, barrel exports for each environment's `interval/` directory, `packages/gmt/README.md` update, changeset, lint/test pass.
```

### B6 — `splitIntervalByUnit`

**GitHub Issue:** #37

**Title:**

```
B6 Add splitIntervalByUnitDate, splitIntervalByUnitTime, splitIntervalByUnitDateTime, splitIntervalByUnitUtc, splitIntervalByUnitUnix, splitIntervalByUnitZoned
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group B, item B6. Depends on B1, and benefits from Duration (Story Group A) existing first per the suggested sequencing.

## Gap
Luxon's `Interval.splitBy` / `divideEqually` divide an interval into sub-intervals by a duration unit (e.g. weekly billing periods). GMT's `mapDatesInRange` maps over dates in a range but isn't interval-typed and doesn't split by arbitrary duration.

## Scope
One function per Temporal environment. Each accepts an interval, a duration unit, and an amount, and returns an array of sub-intervals:
- `splitIntervalByUnit(start: string, end: string, unit: string, amount: number): Array<{ start: string; end: string }>`
  - Returns an array of `{ start, end }` records that tile the interval in steps of `amount × unit`.
  - The final sub-interval is trimmed so its `end` never exceeds the original `end`.
  - Returns `[]` on invalid input (unparseable start/end, unsupported unit, non-positive amount).
Unit mapping per environment:
  - `plain/date` and `plain/datetime` and `utc` and `zoned`: accepts `DateTimeDurationUnit` strings — `'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond'`
  - `plain/time`: accepts `TimeDurationUnit` strings — `'hour' | 'minute' | 'second' | 'millisecond'`
  - `unix`: accepts `UnixDurationUnit` strings — `'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond'`
Environment variants:
- `plain/interval/splitIntervalByUnitDate.ts` → `splitIntervalByUnitDate`
- `plain/interval/splitIntervalByUnitTime.ts` → `splitIntervalByUnitTime`
- `plain/interval/splitIntervalByUnitDateTime.ts` → `splitIntervalByUnitDateTime`
- `utc/interval/splitIntervalByUnitUtc.ts` → `splitIntervalByUnitUtc`
- `unix/interval/splitIntervalByUnitUnix.ts` → `splitIntervalByUnitUnix`
- `zoned/interval/splitIntervalByUnitZoned.ts` → `splitIntervalByUnitZoned`
Implementation pattern: regex/typeof kind detection → parse start → loop adding `amount × unit` until past `end`, trimming the final slice.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: `plain/map/mapDatesInRange.ts` (range iteration pattern) plus the per-namespace `duration/add*` functions for unit-aware addition.

## Definition of done
Tests (exact division, remainder/partial-final-interval, zero/negative amount → [], unparseable input → [], unsupported unit → []), JSDoc with `@example` for each environment, barrel exports for each environment's `interval/` directory, `packages/gmt/README.md` update, changeset, lint/test pass.
```

### B7 — Interval set operations (`difference`, `xor`, `abuts`, `engulfs`)

**GitHub Issue:** Issue #79

**Title:**

```
B7 Add intervalDifference, intervalXor, intervalAbuts, intervalEngulfs
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group B, item B7. Depends on B1, B4 (reuse the `{ start, end } | null` / array return conventions established there). Surfaced by a full ground-truth `.d.ts` audit against Luxon's `Interval` class (2026-08-12) — B1–B6 cover `contains`/`overlaps`/`intersection`/`union`/`splitBy`, but four distinct `Interval` capabilities were missed by the original context7-sampling-based gap research and are not implemented by any B1–B6 story: `Interval.difference`, `.xor`, `.abutsStart`/`.abutsEnd`, `.engulfs`.

## Gap
Luxon's `Interval` class has four set-relationship/set-operation methods with no GMT equivalent, verified absent from both GMT's source (`packages/gmt/src` full grep, 2026-08-12) and every B1–B6 spec:
- `Interval.difference(...intervals)` — subtracts one or more intervals from another, returning the remaining piece(s). Distinct from B4's `intervalIntersection` (which returns the overlap, not what's left over).
- `Interval.xor(intervals)` — symmetric difference across a set of intervals (time covered by exactly one interval, not by an even number of them). Distinct from B5's `intervalUnion` (combined span) and B4's intersection.
- `Interval.abutsStart` / `Interval.abutsEnd` — adjacency check: does another interval touch this one's start/end with zero gap and zero overlap. Distinct from B3's `intervalsOverlap` (which is `false` for adjacent-but-touching intervals) — this is the complementary "exactly touching" case B3 explicitly excludes.
- `Interval.engulfs` — full containment of one interval by another (every instant of B is within A), as an interval-vs-interval boolean. Distinct from B2's `intervalContains` 4-argument mode — confirm during spec expansion whether B2's existing 4-arg interval-in-interval mode already covers this exactly, or whether a dedicated function is still warranted for API-naming parity with Luxon (this may turn out to be a naming/aliasing decision rather than new logic — do not implement duplicate logic if B2 already covers it).

## Scope
One function per Temporal environment per capability that survives the B2-overlap check above:
- `intervalDifference(aStart: string, aEnd: string, bStart: string, bEnd: string): Array<{ start: string; end: string }>` — the portion(s) of interval A not covered by interval B; can return 0, 1, or 2 sub-intervals (B fully inside A with gaps on both sides), `[]` on invalid input.
- `intervalXor(aStart: string, aEnd: string, bStart: string, bEnd: string): Array<{ start: string; end: string }>` — symmetric difference; `[]` on invalid input.
- `intervalAbuts(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean` — `true` only when the intervals are exactly adjacent (one's end equals the other's start) with no overlap; `false` on invalid input.
- `intervalEngulfs(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean` — only add if confirmed distinct from B2's 4-argument `intervalContains` per the Gap section above.
Environment variants: same six-namespace pattern as B1–B6 (`plain/date`, `plain/time`, `plain/dateTime`, `utc`, `unix`, `zoned`) for each function that's added.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: B4 (`intervalIntersection`)/B5 (`intervalUnion`) for return-shape conventions, B3 (`intervalsOverlap`) for the adjacency-vs-overlap boundary logic `intervalAbuts` needs to complement rather than duplicate. Re-verify Luxon's exact `difference`/`xor`/`abutsStart`/`abutsEnd`/`engulfs` semantics via context7 before finalizing signatures — this spec's description is from a `.d.ts` surface read, not full behavioral verification.

## Definition of done
Tests per function (adjacency edge cases for `intervalAbuts` specifically — off-by-one on touching vs. one-unit-gap; multi-piece results for `intervalDifference`/`intervalXor`; invalid input sentinel returns), JSDoc with `@example`, barrel exports, `packages/gmt/README.md` update, changeset, lint/test pass.
```
