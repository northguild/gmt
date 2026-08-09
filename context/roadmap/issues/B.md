### B1 — `isValidInterval`

**GitHub Issue:** #32

**Title:**

```
B1 Add isValidInterval
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group B, item B1. Foundation for B2–B6.

## Gap
Luxon's `Interval` class validates start/end pairs. GMT has no interval/range type at all — only scalar `isBetween*` checks (`plain/compare/isBetweenDate.ts` etc.).

## Scope
- `isValidInterval(start: string, end: string): boolean` — validate that both are parseable and `start <= end`.
- New `src/interval/` namespace (plain, ISO datetime strings first — zoned intervals are a later story per the roadmap note under Group B).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: `plain/validate/isValidDateRange.ts` — check whether it already covers this before building new.

## Definition of done
Tests, JSDoc, exports, README/changeset, lint/test pass — per `context/coding-standards.md` / `context/testing-standards.md` / `context/jsdoc-standards.md`.
```

### B2 — `intervalContains`

**GitHub Issue:** #33

**Title:**

```
B2 Add intervalContains
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group B, item B2. Depends on B1.

## Gap
Luxon's `Interval.contains` checks whether a point or another interval falls fully within an interval. GMT has no equivalent.

## Scope
- `intervalContains(intervalStart: string, intervalEnd: string, pointOrStart: string, pointEnd?: string): boolean` — exact signature to be finalized at implementation time; support both point-in-interval and interval-fully-contains-interval checks (confirm with existing `isBetweenDate` signature conventions for consistency).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`.

## Definition of done
Tests (boundary-inclusive/exclusive cases explicitly covered), JSDoc, exports, README/changeset, lint/test pass.
```

### B3 — `intervalsOverlap`

**GitHub Issue:** #34

**Title:**

```
B3 Add intervalsOverlap
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group B, item B3. Depends on B1.

## Gap
Luxon's `Interval.overlaps` checks whether two intervals share any time. GMT has no equivalent.

## Scope
- `intervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean`

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`.

## Definition of done
Tests (adjacent-but-not-overlapping, fully-contained, partial-overlap cases), JSDoc, exports, README/changeset, lint/test pass.
```

### B4 — `intervalIntersection`

**GitHub Issue:** #35

**Title:**

```
B4 Add intervalIntersection
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group B, item B4. Depends on B1, B3.

## Gap
Luxon's `Interval.intersection` returns the overlapping sub-interval of two intervals. GMT has no equivalent.

## Scope
- `intervalIntersection(aStart: string, aEnd: string, bStart: string, bEnd: string): { start: string; end: string } | null` — exact return shape to be finalized (note: GMT's sentinel convention doesn't define a standard for object-returning functions — establish and document one here since B5/B6 will follow the same pattern).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`.

## Definition of done
Tests (no-overlap → null, full-overlap, partial-overlap), JSDoc, exports, README/changeset, lint/test pass.
```

### B5 — `intervalUnion`

**GitHub Issue:** #36

**Title:**

```
B5 Add intervalUnion
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group B, item B5. Depends on B1, B4 (reuse the object-return convention established there).

## Gap
Luxon's `Interval.union` returns the combined span of two overlapping/adjacent intervals. GMT has no equivalent.

## Scope
- `intervalUnion(aStart: string, aEnd: string, bStart: string, bEnd: string): { start: string; end: string } | null` — decide and document behavior for non-overlapping, non-adjacent intervals (null, or throw-then-catch-to-sentinel per `context/coding-standards.md`).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`.

## Definition of done
Tests, JSDoc, exports, README/changeset, lint/test pass.
```

### B6 — `splitIntervalByUnit`

**GitHub Issue:** #37

**Title:**

```
B6 Add splitIntervalByUnit
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group B, item B6. Depends on B1, and benefits from Duration (Story Group A) existing first per the suggested sequencing.

## Gap
Luxon's `Interval.splitBy`/`divideEqually` divide an interval into sub-intervals by a duration unit (e.g. weekly billing periods). GMT's `mapDatesInRange` maps over dates in a range but isn't interval-typed and doesn't split by arbitrary duration.

## Scope
- `splitIntervalByUnit(start: string, end: string, unit: DateTimeDurationUnit, amount: number): Array<{ start: string; end: string }>` — return `[]` on invalid input.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: `plain/map/mapDatesInRange.ts`.

## Definition of done
Tests (exact division, remainder/partial-final-interval handling), JSDoc, exports, README/changeset, lint/test pass.
```
