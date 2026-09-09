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

- **Half-open `[start, end)` everywhere.** A container that gates out at exactly 17:00 on the last free day has not used a day of demurrage. Closed intervals double-count at every boundary, and mixed conventions across realms guarantee disputes. State it once, here, and never vary it.
- **Zero-length intervals are valid** and represent an instant. `sumIntervals` of an empty list is `PT0S`, not a sentinel.
- Inverted intervals (`end` before `start`) are invalid input and return sentinels rather than being silently normalised — an inverted interval is nearly always a caller bug.
- Interval endpoints are instants. Where a realm needs local-calendar boundaries, it composes with `floorToZone` from CORE-5 rather than this module growing zone awareness.

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
- `pnpm run validate` stays green
