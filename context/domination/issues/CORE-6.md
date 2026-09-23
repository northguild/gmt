# CORE-6 — Core: Interval algebra

**Scope:** Overlap, intersection, clamp, split-at-boundary, merge and subtract over time intervals.

## Gap

Four realms need the same operation and none of them can express it: sum the parts of an interval that fall inside a set of allowed windows.

- Laytime counts only the hours a SHEX or weather-working-day clause allows (MAR-19).
- Driver hours split a duty period around mandatory breaks and rest (ROAD-20, ROAD-21).
- Free time counts only working days when the tariff says working days (INT-12).
- Market session logic asks how much of a window fell inside continuous trading (FIN-40).

Without a shared primitive each realm reimplements interval intersection, and they will not agree on boundary semantics.

## Scope

- `packages/gmt/src/interval/compare/`:
  - `intervalsOverlap(a: Interval, b: Interval): boolean` — Half-open `[start, end)`. Touching intervals do not overlap.
  - `intervalContains(interval: Interval, isoString: string): boolean`
- `packages/gmt/src/interval/calculate/`:
  - `intersectIntervals(a: Interval, b: Interval): Interval | null`
  - `clampInterval(interval: Interval, bounds: Interval): Interval | null`
  - `subtractIntervals(from: Interval, remove: Interval[]): Interval[]` — The parts of `from` not covered by `remove`.
  - `mergeIntervals(intervals: Interval[]): Interval[]` — Sorted, with overlapping and adjacent intervals coalesced.
  - `splitIntervalAt(interval: Interval, boundaries: string[]): Interval[]`
  - `sumIntervals(intervals: Interval[]): string` — Total as an ISO duration.
- `Interval` is `{ start: string, end: string }` of ISO strings, exported from `packages/gmt/src/types/`.

## Design notes

Implementation spec: [`../specs/CORE-6-spec.md`](../specs/CORE-6-spec.md). Range-edge defects found and fixed during this story, the sites proven safe, and the `@js-temporal/polyfill` defects: [`../research/range-edge-correctness-audit.md`](../research/range-edge-correctness-audit.md).

- **Half-open `[start, end)` everywhere.** An instant `t` is inside when `start ≤ t < end`. This is EWD831's convention, SQL:2011's closed-open application-time `PERIOD` (ISO/IEC 9075-2:2011), and RFC 5545 §3.6.1's non-inclusive `DTEND`. A container that gates out at exactly 17:00 on the last free day has not used a day of demurrage. Closed intervals double-count at every boundary, and mixed conventions across realms guarantee disputes. State it once, here, and never vary it. The older positional `plain|utc|zoned|unix/interval` functions came before this rule and were brought onto it in 1.16.0 ([coding-standards § 8](../../coding-standards.md#8-intervals-are-half-open-start-end)).
- **Zero-length intervals are valid.** `start = end` is an *empty* interval: it has a position but contains no instant, so `intervalContains` is always `false` for it. `sumIntervals` of an empty list is `PT0S`, not a sentinel.
- Inverted intervals (`end` before `start`) are invalid input and return sentinels rather than being silently normalised — an inverted interval is nearly always a caller bug.
- **Endpoints are instants.** They use the RFC 9557 instant grammar as `Temporal.Instant.from` parses it: an offset (`Z` or `±HH:MM`) is required and a `[Zone]` annotation is optional. GMT's `parseInstantNanoseconds` also rejects leap seconds. A calendar annotation (`[u-ca=…]` or the critical `[!u-ca=…]`) and any other elective `[key=value]` annotation are ignored, as `Temporal.Instant.from` ignores them; an unknown critical annotation such as `[!foo=bar]` is rejected (RFC 9557 §3.3). A TC39 `Temporal.Instant` has no zone or calendar, so endpoints compare by epoch nanoseconds only and may carry different zones. **Outputs return the caller's own strings unchanged**, never re-serialised. Where a realm needs local-calendar boundaries, it composes with `floorToZone` from CORE-5 rather than this module growing zone awareness.
- **Ties between spellings (GMT rule; no spec covers it).** When two strings name the same instant, the output uses the first argument's string:
  - `intersectIntervals` and `clampInterval` take the first argument's string.
  - A merged run keeps its first start (sorted by instant, with input order breaking ties) and the first end to reach the run's maximum.
  - `subtractIntervals` prefers `from`'s strings.
  - `splitIntervalAt` keeps the first occurrence of duplicate boundaries.

  Why: every output endpoint must be one of the caller's strings, and a rule based on position is deterministic without inventing a canonical spelling.
- **Empty intervals at the edges (GMT rule).** Why: an empty interval covers no time, so it cannot change coverage, only mark a position.
  - **Overlap** is `a.start < b.end && b.start < a.end`, so it is true exactly when `intersectIntervals` is non-null.
    - Touching intervals do not overlap, and neither does an empty interval at an edge.
    - An empty interval strictly inside does overlap, and the intersection is that empty interval.
  - **Merge** joins touching intervals and absorbs empty intervals that touch or fall inside a run. An empty interval that touches nothing is dropped.
  - **Subtract:** removing an empty interval changes nothing, and subtracting from an empty `from` gives `[]`.
  - **Split** drops boundaries at or outside the edges, and splitting an empty interval returns it unchanged.
  - Inputs may be unsorted; outputs are sorted.
- **`sumIntervals` is covered time.** It is the length of the union: overlaps count once and empty intervals count zero.
  - **Format:** an exact duration with hours as the largest unit, identical to TC39 `Temporal.Instant.prototype.until(…, { largestUnit: "hour" }).toString()`. Instant arithmetic has no days, because an instant has no calendar.
  - **Precision:** it is summed as bigint nanoseconds, so it stays exact past 2^53 ns and across the full ±10^8-day Instant range.
- **`[]` is both a legitimate result and the array sentinel.** A fully covered subtraction, for example, returns `[]`. `isValidInterval` tells the two apart.

## What gmt provides (do not re-implement)

- `isValidZonedInterval` / `isValidUtcInterval` — existing interval validators
- `spanMs` / `spanNs` from CORE-2 — interval length
- `floorToZone` from CORE-5 — for callers building zone-aligned boundary lists

## Verification

- Touching intervals: `intervalsOverlap({..., end: 'T17:00Z'}, {start: 'T17:00Z', ...})` returns `false`
- `intersectIntervals` returns `null` for disjoint intervals
- `subtractIntervals` splits an interval into two when the removal falls strictly inside it
- `mergeIntervals` coalesces adjacent intervals and preserves sort order
- `sumIntervals([])` returns `'PT0S'`
- Inverted interval returns the sentinel
- Round-trip: `sumIntervals(subtractIntervals(i, r)) + sumIntervals(intersections)` equals the length of `i`
- Zero known bugs: `node scripts/test-markers.mjs check` passes, and every range-edge defect in the audit record is fixed with a covering test
- `pnpm run validate` stays green
