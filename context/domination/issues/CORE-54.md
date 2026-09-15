# CORE-54 — Core: Convert the positional interval functions to half-open `[start, end)` (2.0.0)

**Scope:** Bring the older positional interval functions in `plain/`, `utc/`, `zoned/` and `unix/` `interval/` onto the half-open rule CORE-6 established, and remove their ±1-unit boundary steps. This is a breaking change, so it ships only in a major release.

## Gap

CORE-6 made half-open `[start, end)` library law for interval algebra over instants. The roughly 100 positional interval functions that came before it do not follow that rule, and three conventions coexist among them:

- **65 files read an interval as closed `[start, end]`.** Both endpoints belong to the interval, so touching intervals overlap and a point at `end` is inside. The functions compensate with ±1-unit steps: `intervalDifference*` and `intervalXor*` stop one nanosecond (or one day, or one epoch unit) short of a cut, and `intervalAbuts*` requires a one-unit gap.
  - Covered families, 6 files each: `intervalsOverlap*`, `intervalContains*`, `intervalEngulfs*`, `intervalIntersection*`, `intervalUnion*`, `mergeIntervals*`, `intervalDifference*`, `intervalXor*`, `intervalXorAll*`, `intervalAbuts*`.
  - Plus `intervalOverlappingDays*` (5 files, no `Time` variant).
- **`intervalCount*` (6) is already half-open.**
- **The tiling functions share endpoints between pieces, so they have no membership rule of their own.** These are `intervalSplitAt*`, `splitIntervalByUnit*` and `intervalDivideEqually*` (18 files). Construction and measurement (`intervalLength*`, `intervalFromDuration*`, 12) and the `isValid*Interval` validators (7) have no membership rule at all.

A caller who composes a positional result with an `interval/` result gets answers that disagree at every boundary. That is the failure CORE-6 exists to prevent. Phase 1, in the CORE-6 PR, corrected the positional documentation to describe the closed behaviour and made no behaviour change. This story is phase 2.

## Scope

- Every closed family listed above moves to `start ≤ t < end`, with the ±1-unit steps removed.
- The tiling functions keep their shapes, and their JSDoc stops describing shared endpoints as belonging to both pieces.
- Decide whether each positional family keeps its own implementation or delegates to `interval/` for the instant-typed variants (`Utc`, `Zoned`, `Unix`). The `Date`, `DateTime` and `Time` variants have no instant, so they need the same rules implemented over their own types.
- Rewrite each positional function's boundary bullets (touching intervals, inclusive endpoints, one-unit steps in `intervalDifference*`/`intervalXor*`/`intervalAbuts*`, `intervalEngulfs*` shared endpoints) to the half-open behaviour.
- Rewrite the closed-model examples in `packages/gmt/README.md` § Intervals and in `apps/dox/src/content/docs/guides/intervals/*.mdx` and `mistakes/interval-ops.mdx`.
- Changeset: `major`. **Ask the owner first**, per [coding-standards § Changesets](../../coding-standards.md#changesets).

## Old → new output

The legacy column below was verified against the shipped build on 2026-09-14. The new column is what CORE-6's `interval/` function returns for the same instants, and it is what each positional function should return after conversion. The `Date` rows and the `intervalOverlappingDays*` row have no `interval/` counterpart, so their new values are derived by applying the half-open rule. Re-derive them in this story's red step.

In the table, `A` = `2024-01-01T09:00:00Z`, `B` = `…T12:00:00Z`, `C` = `…T13:00:00Z` and `D` = `…T17:00:00Z`.

| Family | Call | Today (closed) | After (half-open) |
| --- | --- | --- | --- |
| `intervalsOverlap*` | `intervalsOverlapUtc(A, B, B, D)`, touching | `true` | `false` |
| `intervalContains*` (point) | `intervalContainsUtc(A, B, B)`, point at `end` | `true` | `false` |
| `intervalContains*` / `intervalEngulfs*` (interval) | `intervalContainsUtc(A, D, B, D)`, same `end` | `true` | `true`: unchanged; check the empty-interval edges |
| `intervalIntersection*` | `intervalIntersectionUtc(A, B, B, D)`, touching | `{ start: B, end: B }` | `null` |
| `intervalIntersection*` | `intervalIntersectionUtc(A, C, B, D)`, overlapping | `{ start: B, end: C }` | `{ start: B, end: C }`: unchanged |
| `intervalUnion*` | `intervalUnionUtc(A, B, B, D)`, touching | `{ start: A, end: D }` | `{ start: A, end: D }`: unchanged |
| `intervalUnion*` / `mergeIntervals*` | 1 ns gap: `(A, B)` and `(…T12:00:00.000000001Z, D)` | `null` / two intervals | `null` / two intervals: unchanged |
| `intervalDifference*` | `intervalDifferenceUtc(A, D, B, C)` | `[{ A, …T11:59:59.999999999Z }, { …T13:00:00.000000001Z, D }]` | `[{ A, B }, { C, D }]` |
| `intervalDifference*` (Date) | `intervalDifferenceDate("2024-01-01", "2024-12-31", "2024-06-01", "2024-07-01")` | `[{ 01-01, 05-31 }, { 07-02, 12-31 }]` | `[{ 01-01, 06-01 }, { 07-01, 12-31 }]` |
| `intervalXor*` | `intervalXorUtc(A, C, B, D)` | `[{ A, …T11:59:59.999999999Z }, { …T13:00:00.000000001Z, D }]` | `[{ A, B }, { C, D }]` |
| `intervalXorAll*` | `intervalXorAllUtc([{ A, C }, { B, D }])` | same as `intervalXorUtc` above | `[{ A, B }, { C, D }]` |
| `intervalAbuts*` | `intervalAbutsUtc(A, B, B, D)`, shared endpoint | `false` | `true` |
| `intervalAbuts*` | `intervalAbutsUtc(A, B, …T12:00:00.000000001Z, D)` | `true` | `false`: they are 1 ns apart |
| `intervalAbuts*` (Date) | `intervalAbutsDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31")` | `true` | `false`: `[01-01, 06-30)` ends before 06-30 |
| `intervalOverlappingDays*` | `intervalOverlappingDaysUtc("2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z", "2024-01-02T00:00:00Z", "2024-01-03T00:00:00Z")` | `1` | `0`: the intersection is empty |
| `intervalSplitAt*` | `intervalSplitAtUtc(A, D, [B])` | `[{ A, B }, { B, D }]` | `[{ A, B }, { B, D }]`: same output, pieces now partition |
| `intervalCount*` | `intervalCountUtc(A, D, "hour")` | `8` | `8`: already half-open |

The planning audit counted about 56 of the 65 closed files whose output changes for some input. The `intervalUnion*` / `mergeIntervals*` rows above show the families whose output can stay identical. Recount each family in this story's red step, and do not rely on that estimate.

`Date` values raise one more design question for this story. A half-open `PlainDate` interval `[2024-01-01, 2024-06-30)` excludes 30 June. Callers who pass "the last day of the period" as `end` today will lose a day. The JSDoc and changeset must say so, and the migration note should show `addDate(end, { days: 1 })`.

## Range-edge regression rows (fixed in CORE-6)

CORE-6 fixed the range-edge bugs in these functions under the current closed model, and each fix is covered by passing tests:

- `PlainTime` midnight wrap in `intervalAbutsTime` and `intervalXorAllTime`.
- Maximum-value overflow in `intervalAbuts*` and `intervalXorAll*`.
- The zone-transition lookup at the maximum instant.
- `endOf*("month")` at the minimum month.
- Unix safe-integer validation.

The full record of causes, fixes, the sites proven safe and the related polyfill defects is [research/range-edge-correctness-audit.md](../research/range-edge-correctness-audit.md). Converting to half-open rewrites the same code. Keep every one of those rows, restated for half-open where the expected value changes, and keep them green. GMT ships zero known bugs ([Core Rule 12](../../../AGENTS.md#core-rules-quick-reference)).

## Design notes

- **Authority is the same as CORE-6.** It rests on SQL:2011 closed-open `PERIOD` (ISO/IEC 9075-2:2011), RFC 5545 §3.6.1 non-inclusive `DTEND` and EWD831. Tie-breaks and empty-interval edges follow CORE-6's GMT-defined rules; see [`../specs/CORE-6-spec.md`](../specs/CORE-6-spec.md) §3.
- **Outputs stay re-serialised values** unless the story decides otherwise. The positional functions take typed strings or numbers, not caller-owned `Interval` records, so CORE-6's "echo the caller's string" rule does not carry over automatically. Record the decision here.
- **Unix variants** step in epoch units, so they have no nanosecond to remove. Their ±1 is one unit of `epochUnit`.

## What gmt provides (do not re-implement)

- `intervalsOverlap` / `intervalContains` / `intersectIntervals` / `mergeIntervals` / `subtractIntervals` / `splitIntervalAt` from CORE-6: the reference semantics, and the implementation to delegate to for instant-typed variants
- `isValidInterval` from CORE-6
- `floorToZone` / `bucketRange` from CORE-5: zone-aligned boundaries in examples

## Verification

- Every "After" cell in the table above is asserted in the converted function's suite.
- For random instant intervals, `intervalsOverlapUtc(a, b)` equals `intervalsOverlap(a, b)`, and the same holds for intersection, difference and merge. Use a property test shaped like CORE-6's `intervalAlgebra.test.ts`.
- Every CORE-6 range-edge regression row still passes, restated for half-open where needed, and `node scripts/test-markers.mjs check` passes.
- No positional interval JSDoc still describes inclusive endpoints or one-unit steps.
- The README and dox interval guides show only half-open outputs.
- The `major` changeset carries a migration table covering at least the rows above.
- `pnpm run validate` stays green.
