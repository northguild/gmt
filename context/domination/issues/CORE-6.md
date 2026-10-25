# CORE-6 — Core: Interval algebra

**Scope:** Overlap, intersection, clamp, split-at-boundary, merge and subtract over time intervals.

## Gap

Four realms need the same operation and none of them can express it: sum the parts of an interval that fall inside a set of allowed windows.

- Laytime counts only the hours a SHEX or weather-working-day clause allows.
- Driver hours split a duty period around mandatory breaks and rest (CORE-76).
- Free time counts only working days when the tariff says working days (INT-12).
- Market session logic asks how much of a window fell inside continuous trading.

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

Range-edge defects found and fixed during this story, the sites proven safe, and the `@js-temporal/polyfill` defects: [`../research/range-edge-correctness-audit.md`](../research/range-edge-correctness-audit.md).

- **Half-open `[start, end)` everywhere.** An instant `t` is inside when `start ≤ t < end`. This is EWD831's convention, SQL:2011's closed-open application-time `PERIOD` (ISO/IEC 9075-2:2011), and RFC 5545 §3.6.1's non-inclusive `DTEND`. A container that gates out at exactly 17:00 on the last free day has not used a day of demurrage. Closed intervals double-count at every boundary, and mixed conventions across realms guarantee disputes. State it once, here, and never vary it. The older positional `plain|utc|zoned|unix/interval` functions came before this rule and were brought onto it in 1.16.0 ([coding-standards § 8](../../coding-standards.md#8-intervals-are-half-open-start-end)).
- **Zero-length intervals are valid.** `start = end` is an *empty* interval: it has a position but contains no instant, so `intervalContains` is always `false` for it. `sumIntervals` of an empty list is `PT0S`, not a sentinel.
- Inverted intervals (`end` before `start`) are invalid input and return sentinels rather than being silently normalised — an inverted interval is nearly always a caller bug.
- **Endpoints are instants.** They use the RFC 9557 instant grammar as `Temporal.Instant.from` parses it: an offset (`Z` or `±HH:MM`) is required and a `[Zone]` annotation is optional. GMT's `parseInstantNanoseconds` also rejects leap seconds. A calendar annotation (`[u-ca=…]` or the critical `[!u-ca=…]`) and any other elective `[key=value]` annotation are ignored, as `Temporal.Instant.from` ignores them; an unknown critical annotation such as `[!foo=bar]` is rejected (RFC 9557 §3.3). A TC39 `Temporal.Instant` has no zone or calendar, so endpoints compare by epoch nanoseconds only and may carry different zones. A `[Zone]` annotation is not validated; the one thing read from it is the real offset behind a minute-rounded one ([coding-standards § Calendar & zone semantics, rule 9](../../coding-standards.md#9-an-instant-string-is-read-as-the-zoned-string-it-may-be)). **Outputs return the caller's own strings unchanged**, never re-serialised. Where a realm needs local-calendar boundaries, it composes with `floorToZone` from CORE-5 rather than this module growing zone awareness.
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

## Decisions

Current rules for the interval namespace and the non-ISO calendar work, with the reason for each.

- **Validation is all-or-nothing and happens before any work.** One invalid element anywhere
  returns the sentinel, even one that could not change the answer (a removal that lies outside
  `from`). Why: a caller that passes a bad element has a bug, and a result that depends on which
  elements happened to matter hides it.
- **Any non-null object with string `start` and `end` is an interval.** Extra keys are ignored
  and never copied. Why: callers hold richer records (a booking, a shift) and should not have to
  strip them. No spec covers this; it is a GMT rule.
- **The first argument wins ties between spellings of one instant.** When two inputs name the
  same instant differently (`2024-01-01T09:00:00Z` and `2024-01-01T04:00:00-05:00`), the output
  keeps the first argument's spelling: `a` in `intersectIntervals`, `interval` in
  `clampInterval`, `from` in `subtractIntervals`, and the first occurrence in `mergeIntervals`
  and `splitIntervalAt`. Why: outputs must be caller strings, and a positional rule is
  deterministic without inventing a canonical spelling. No spec covers this; it is a GMT rule.
- **Outputs are fresh `{ start, end }` objects built from the caller's strings.** An output is never
  the caller's object, and every endpoint is one of the caller's spellings (see the tie rule
  above).
- **Only `interval/` takes caller-owned `Interval` records.** The older positional functions
  (`plain|utc|zoned|unix/interval`) take bare values, not records, and return their type's
  canonical spelling. Why: `interval/` echoes the caller's strings because the caller owns the
  record; a bare value has no owner whose spelling must survive.
- **Instants are compared as bigint epoch nanoseconds** and summed the same way, so a total stays
  exact past 2^53 ns across the full instant range. Output durations stop at hours because an
  instant has no calendar to define a day (`largestUnit: "day"` throws in TC39 Temporal).
- **Non-ISO calendars follow the spec algorithm, and GMT owns calendar data only where the standard
  cannot be met without it.** GMT reads fields, month lengths and eras from the polyfill wherever
  the polyfill is correct, and holds no era offsets, month lengths, leap cycles, epochs or cutover
  dates of its own. The two exceptions are the published Hebrew arithmetic (Dershowitz and
  Reingold) and the Indian leap rule for years the runtime gets wrong; the owner ruled that the
  standard wins over the future-proofing rule there, and a sentinel is not a conforming answer. A
  workaround is dormant until a probe of the installed polyfill or runtime fails, lives in
  `internal/temporalCompat/`, and is deleted without changing any output once upstream ships the
  fix. The rules, the defect table and the removal steps are in the
  [temporalCompat README](../../../packages/gmt/src/internal/temporalCompat/README.md). The
  owner's choices on grammar, era codes, Buddhist, Hebrew and Indian ranges, and calendar aliases
  are in [calendar-standards-decisions](../research/calendar-standards-decisions.md).
- **Expected values come from the standard, never from GMT or the polyfill.** The order is the
  ECMA-402 Intl era and month-code text, then test262, then the native engine (Chromium), then an
  independent arithmetic oracle (Dershowitz and Reingold for Hebrew). The weekly canary runs the
  same scan against the native engine.

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
