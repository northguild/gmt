### I1 — `getOverlappingDaysCount`

**GitHub Issue:** Issue #80

**Title:**

```
I1 Add getOverlappingDaysCount plain and zoned
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group I, item I1. Surfaced by a full ground-truth API-surface audit (2026-08-12) against date-fns's `getOverlappingDaysInIntervals`, run after Story Groups A–H and E1–E5 were specced, to sanity-check whether the roadmap as planned actually reaches full parity. Depends on B1/B3 (interval namespace, overlap-detection logic) — do not start before B lands.

## Gap
date-fns's `getOverlappingDaysInIntervals(intervalA, intervalB)` returns a *count* of whole calendar days two intervals share, distinct from B3's `intervalsOverlap` (boolean) and B4's `intervalIntersection` (the overlapping sub-interval as start/end timestamps, not a day count). Nothing in Story Group B or G computes a day-granularity overlap count.

## Scope
- `getOverlappingDaysCount(aStart: string, aEnd: string, bStart: string, bEnd: string): number | null` (plain, date-typed intervals) — `null` on invalid input per GMT's number-return sentinel convention.
- Zoned equivalent as a follow-up once the plain version establishes the pattern, consistent with how Story Group B sequences plain-then-zoned.
- Confirm at spec-expansion time whether "day" here means calendar day (midnight-to-midnight) or a rolling 24-hour count — date-fns's own semantics need re-verification via context7 before finalizing, since this spec is derived from a `.d.ts`/source read, not full behavioral verification.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: B4's `intervalIntersection` for overlap-detection logic, reused here but the result reduced to a day count instead of returned as an interval.

## Definition of done
Tests (partial-day overlap rounding behavior, exact-day-multiple overlap, no-overlap → 0 or null per the sentinel decision made during spec expansion, invalid input → null), JSDoc, exports, README/changeset, lint/test pass.
```

### I2 — `formatRelative*` rounding-method option

**GitHub Issue:** Issue #81

**Title:**

```
I2 Add roundingMethod option to formatRelative plain/zoned/unix/utc
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group I, item I2. Surfaced by the same 2026-08-12 audit, checking date-fns's `formatDistanceStrict`.

## Gap
GMT's existing `formatRelative*` family (`plain/format/formatRelativeDate.ts`, `formatRelativeDateTime.ts`, `formatRelativeTime.ts`, `zoned/format/formatRelativeZoned.ts`, `unix/format/formatRelativeUnix.ts`, `utc/format/formatRelativeUtc.ts`) already supports unit-forcing via `largestUnit` — confirmed via source read (2026-08-12), this is **not** a new-function gap. What's missing is date-fns's `formatDistanceStrict`'s `roundingMethod` option (`'floor' | 'ceil' | 'round'`) controlling how the computed distance rounds to the target unit — GMT's existing implementation has no equivalent control, confirmed absent from `FormatRelativeUtcOptions` and its sibling option interfaces.

## Scope
Add an optional `roundingMethod?: 'floor' | 'ceil' | 'round'` parameter (default `'round'`, matching current behavior — non-breaking) to all six `formatRelative*` functions' options object, alongside the existing `style`/`numeric`/`largestUnit`/`reference`/`timeZone` options. Extract a shared option type if one doesn't already exist for this family (check whether `FormatRelativeUtcOptions`-style interfaces are already per-function or already shared before adding a new shared type).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: the existing `formatRelativeUtc.ts` implementation and its sibling functions — this is an additive option on existing functions, not new files. Re-verify date-fns's exact `roundingMethod` semantics via context7 before finalizing the rounding behavior at each boundary.

## Definition of done
Tests per function (a case where floor/ceil/round produce three different displayed units for the same input, default-unchanged-behavior regression case), JSDoc updated with the new option, README/changeset, lint/test pass.
```

### I3 — `listDstTransitions`

**GitHub Issue:** Issue #82

**Title:**

```
I3 Add listDstTransitions
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group I, item I3. Surfaced by the same 2026-08-12 audit, checking `@date-fns/tz`'s `tzScan`. Distinct from Story Group H3's `hasDaylightSaving` (yes/no a zone has DST at all) and Story Group C's `disambiguation`/`offset` options (what to do when a specific construction lands in an ambiguous/gap instant) — this is enumerating *where* the transition instants actually fall for a given zone/year, which neither H3 nor C provides.

## Gap
`@date-fns/tz`'s `tzScan` enumerates DST transition points for a given IANA zone over a year. GMT has no equivalent — confirmed via full-codebase grep (2026-08-12), no transition-listing function exists anywhere in `packages/gmt/src`.

## Scope
- `listDstTransitions(timeZone: string, year: number): Array<{ instant: string; offsetBefore: string; offsetAfter: string }>` (or equivalent shape — finalize field names at spec-expansion time) — `[]` on invalid timezone/year or a zone with no DST transitions in that year (not an error case; a valid zone can simply have zero transitions).
- Implementation approach to confirm at spec-expansion time: likely a Temporal-based scan comparing UTC offset at regular intervals across the year to locate transition boundaries, then refining to the exact instant via bisection — verify this is robust for zones with more than 2 transitions/year (some zones have had rule changes producing extra transitions in a single year) before committing to a "find exactly 2" assumption.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: Story Group H3's `hasDaylightSaving` for the DST-detection primitive (this story likely reuses or extends whatever offset-comparison logic H3 establishes — sequence I3 after H3 rather than in parallel). Also review `docs/dst-disambiguation.md` for existing DST terminology to stay consistent.

## Definition of done
Tests (a zone with exactly 2 annual transitions, a zone with 0 transitions in a given year, a southern-hemisphere zone, a year spanning a historical rule change if one is reachable via Temporal's tzdata, invalid timezone/year), JSDoc, exports, README/changeset, lint/test pass.
```

### I4 — `getHoursInZonedDay`

**GitHub Issue:** Issue #83

**Title:**

```
I4 Add getHoursInZonedDay
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group I, item I4. Surfaced by the same 2026-08-12 audit, checking `@internationalized/date`'s `getHoursInDay`.

## Gap
`@internationalized/date`'s `getHoursInDay(zonedDate)` returns the number of hours in a specific calendar day for a given zone — 23, 24, or 25 depending on whether that day contains a DST transition. GMT has no equivalent; confirmed via full-codebase grep (2026-08-12).

## Scope
- `getHoursInZonedDay(value: string): number | null` (zoned only — this is meaningless without a timezone, unlike most of GMT's plain/zoned/unix/utc quadruplet pattern) — `null` on invalid input per GMT's number-return sentinel convention. Returns `23`/`24`/`25` for the calendar day the zoned value falls on.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: `zoned/get/getZonedDay.ts` for the sentinel/validation pattern; likely implemented via `Temporal.ZonedDateTime`'s `startOfDay`/day-boundary arithmetic comparing the instant span across the calendar day.

## Definition of done
Tests (a 23-hour spring-forward day, a 25-hour fall-back day, a normal 24-hour day, a zone with no DST at all, invalid input → null), JSDoc, exports, README/changeset, lint/test pass.
```
