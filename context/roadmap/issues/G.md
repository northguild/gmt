### G1 — `intervalCount`

**GitHub Issue:** #58

**Title:**

```
G1 Add intervalCount
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group G, item G1. Depends on B1 (interval namespace/conventions established). Gap confirmed via context7 against Luxon (2026-08-08), found during a competitive research pass.

## Gap
Luxon's `Interval.count(unit)` returns the number of calendar-unit boundaries crossed between an interval's start and end — distinct from `.length(unit)`'s exact duration. E.g. an interval from 11:59pm to 12:01am crosses one day boundary (`count("days") === 2`) despite being 2 minutes long. GMT's B-group interval functions have no equivalent of this calendar-boundary-counting semantic.

## Scope
- `intervalCount(start: string, end: string, unit: DateTimeDurationUnit): number | null` — return `null` on invalid input, per GMT's number-return sentinel convention. Confirm exact semantics against Luxon's `Interval.count` during spec expansion (inclusive/exclusive boundary treatment needs explicit test cases).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: whichever B-group function established the interval namespace (B1) and any B-group function returning a number (e.g. compare with `plain/get/getDayOfWeek.ts`'s sentinel convention).

## Definition of done
Tests (sub-unit-length interval crossing a boundary, exact-multiple interval, zero-length interval, invalid input), JSDoc, exports, README/changeset, lint/test pass.
```

### G2 — `intervalFromDuration`

**GitHub Issue:** #59

**Title:**

```
G2 Add intervalFromDuration
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group G, item G2. Depends on B1 (interval namespace/conventions) and Story Group A (Duration — needs an ISO 8601 duration string as input). Gap confirmed via context7 against Luxon (2026-08-08).

## Gap
Luxon's `Interval.after(start, duration)` / `Interval.before(end, duration)` construct an interval from a single point plus a duration, anchored at either end. GMT's B-group functions all take two explicit endpoints — there's no convenience constructor from a point + duration.

## Scope
- `intervalFromDuration(value: string, duration: string, anchor: 'start' | 'end'): { start: string; end: string } | null` — exact signature (single function with an anchor param vs. two sibling functions mirroring Luxon's `after`/`before`) to be finalized at implementation time; follow whichever convention B4/B5 established for object-returning functions. Return `null` on invalid input (unparseable `value`, invalid `duration` per `isValidDuration`, or a `duration` requiring `relativeTo` that isn't satisfiable from a bare point — document this constraint, mirroring A2/A3's documented `relativeTo` gaps).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: B4 (`intervalIntersection`)/B5 (`intervalUnion`) for the object-return convention, A1 (`parseDuration`/`isValidDuration`) for validating the `duration` input.

## Definition of done
Tests (both anchors, invalid `value`, invalid `duration`, a calendar-unit duration that hits the `relativeTo` constraint), JSDoc, exports, README/changeset, lint/test pass.
```
