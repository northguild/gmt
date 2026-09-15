# CORE-6 — Interval algebra: implementation spec

Story: [`issues/CORE-6.md`](../issues/CORE-6.md) (tracker #187, `Blocked by` —).
Decisions D1–D7 are owner-approved and final. This spec turns them into signatures, algorithms,
JSDoc and test rows. It does not re-open them.

**Location.** The repo had no established folder for story specs. This file creates
`context/domination/specs/`.

**Verification.** Every expected value below was produced by running code, not by reasoning:

- the real `parseInstantNanoseconds` and `@js-temporal/polyfill` 0.x under vitest 4.1.4 on
  Node 24.21;
- a scratch reference implementation of the algorithms in §3;
- the shipped legacy functions, for §8.

tdd-dev still re-verifies each row in its own red step.

---

## 0. Authority — what each rule rests on

| Rule | Source |
| --- | --- |
| `t ∈ [start, end) ⇔ start ≤ t < end` | EWD831 (Dijkstra, *Why numbering should start at zero*); SQL:2011 application-time `PERIOD` is closed-open (ISO/IEC 9075-2:2011); RFC 5545 §3.6.1 `DTEND` is the non-inclusive end |
| Endpoints are instants; zone and calendar are irrelevant to ordering | TC39 Temporal: `Temporal.Instant` carries only epoch nanoseconds, with no time zone or calendar |
| Instant string grammar | RFC 9557 / ISO 8601-1, as `Temporal.Instant.from` parses it, narrowed by GMT's `parseInstantNanoseconds`: no leap seconds (Temporal clamps `:60` rather than rejecting it), no `[u-ca=]` |
| Instant range ±8.64 × 10^21 ns (±10^8 days) | TC39 Temporal `Instant` limits. Verified: `fromEpochNanoseconds(8640000000000000000001n)` throws `RangeError` |
| Duration output uses hours as the largest unit | TC39 Temporal: `Instant.prototype.until` accepts `largestUnit` up to `"hour"`. Verified: `largestUnit: "day"` throws `RangeError`, because an instant has no calendar to define a day |
| Duration serialisation | TC39 Temporal `Duration.prototype.toString` (ISO 8601 duration format `PnYnMnDTnHnMnS`) |
| `[]` / `null` / `false` / `""` sentinels | [coding-standards § API Contract](../../coding-standards.md#api-contract) |
| Tie-breaks between different spellings of one instant; empty-interval edge cases; accepting any non-null object with string `start`/`end` | **GMT rule.** No spec covers these. Reasoning is given where each rule is stated |

---

## 1. Files and signatures

### 1.1 Public

| File | Export |
| --- | --- |
| `packages/gmt/src/types/interval.ts` | `export type Interval = { start: string; end: string };` |
| `packages/gmt/src/interval/validate/isValidInterval.ts` | `export function isValidInterval(interval: Interval): boolean` |
| `packages/gmt/src/interval/compare/intervalsOverlap.ts` | `export function intervalsOverlap(a: Interval, b: Interval): boolean` |
| `packages/gmt/src/interval/compare/intervalContains.ts` | `export function intervalContains(interval: Interval, isoString: string): boolean` |
| `packages/gmt/src/interval/calculate/intersectIntervals.ts` | `export function intersectIntervals(a: Interval, b: Interval): Interval \| null` |
| `packages/gmt/src/interval/calculate/clampInterval.ts` | `export function clampInterval(interval: Interval, bounds: Interval): Interval \| null` |
| `packages/gmt/src/interval/calculate/mergeIntervals.ts` | `export function mergeIntervals(intervals: Interval[]): Interval[]` |
| `packages/gmt/src/interval/calculate/subtractIntervals.ts` | `export function subtractIntervals(from: Interval, remove: Interval[]): Interval[]` |
| `packages/gmt/src/interval/calculate/splitIntervalAt.ts` | `export function splitIntervalAt(interval: Interval, boundaries: string[]): Interval[]` |
| `packages/gmt/src/interval/calculate/sumIntervals.ts` | `export function sumIntervals(intervals: Interval[]): string` |

Each has a colocated `*.test.ts`.

**Name collisions.** A grep of `packages/gmt/src` found no existing export named `Interval`, any
of the nine functions, or the internal helper names below. `export *` will not collide.

### 1.2 Internal helpers (new, with rationale)

**`packages/gmt/src/internal/intervalNanoseconds.ts`** (+ `intervalNanoseconds.test.ts`)

```ts
/** An `Interval` parsed once: bigint epoch nanoseconds plus the exact strings they came from. */
export interface IntervalNanoseconds {
  start: bigint;
  end: bigint;
  startText: string;
  endText: string;
}

export function parseIntervalNanoseconds(value: unknown): IntervalNanoseconds | null;
export function parseIntervalNanosecondsList(values: unknown): IntervalNanoseconds[] | null;
export function coalesceIntervalNanoseconds(
  records: readonly IntervalNanoseconds[],
): IntervalNanoseconds[];
```

Rationale:

- All nine functions need the same validation: an object, two instant strings, `start ≤ end`.
  Three of them (merge, subtract, sum) need the same sweep.
- Carrying `startText`/`endText` next to the bigints is what makes D3's echo rule structural.
  Outputs are built only from `*Text` fields, so no code path can re-serialise.
- This follows `spanNs`: it parses once with `parseInstantNanoseconds` and does not call a
  separate `isValid*` first. The "validate then parse" convention exists to keep contracts
  explicit, and here the parse *is* the validator. There is nothing to double-parse.

`parseIntervalNanoseconds(value)`:

1. `typeof value !== "object" || value === null` → `null`. Arrays fall through and fail at step 3,
   because `[].start` is `undefined`.
2. Read `value.start` and `value.end` **once each** into locals. A getter must not be able to
   make the validated string differ from the echoed one.
3. `start = parseInstantNanoseconds(startText)` and the same for end. Either `null` → `null`.
   Non-strings are already `null` there.
4. `start > end` → `null`.
5. Return `{ start, end, startText, endText }`.

**GMT rule:** any non-null object with string `start`/`end` is accepted, including class
instances and objects with extra keys. Extra keys are ignored and never copied to outputs.
Reason: the type is structural, and rejecting extra keys would break callers passing richer
records (a shift, a berth window).

`parseIntervalNanosecondsList(values)`:

- `!Array.isArray(values)` → `null`.
- Parse every element. Any `null` → `null` (all-or-nothing, like `mergeIntervalsUtc`).
- Otherwise return the records in input order.
- Holes in sparse arrays are `undefined` → `null`.

`coalesceIntervalNanoseconds(records)` is the sweep shape of `mergeIntervalsUtc`, with the D3/D5
boundary rules:

```ts
const sorted = [...records].sort((x, y) => (x.start < y.start ? -1 : x.start > y.start ? 1 : 0));
// Array.prototype.sort is stable (ES2019), so equal starts keep input order.
const runs: IntervalNanoseconds[] = [];
for (const record of sorted) {
  const last = runs[runs.length - 1];
  if (last && record.start <= last.end) {       // <= : touching coalesces
    if (record.end > last.end) {                // strict: first to reach the max end keeps its text
      last.end = record.end;
      last.endText = record.endText;
    }
  } else {
    runs.push({ ...record });                   // copy; never mutate caller-derived records
  }
}
return runs.filter((run) => run.start < run.end); // stranded empties dropped
```

- An empty interval that touches or falls inside a run satisfies `start <= last.end` and is
  absorbed.
- An empty interval that starts a run is extended if a later record touches it. The run's start
  text is then the empty interval's text, because it came first in sorted order.
- An empty interval that nothing touches stays a zero-length run and is filtered out.

**`packages/gmt/src/internal/hourDurationString.ts`** (+ `hourDurationString.test.ts`)

```ts
/**
 * Format a non-negative count of nanoseconds as an ISO 8601 duration with hours as the largest
 * unit — the string `Temporal.Instant.prototype.until(…, { largestUnit: "hour" }).toString()`
 * produces for a span of that length. Returns "" for a negative count or if Temporal throws.
 */
export function formatHourDuration(nanoseconds: bigint): string;
```

Body:

1. `nanoseconds < 0n` → `""`.
2. Split the value with bigint `/` and `%`:
   - `NANOSECONDS_PER_HOUR = 3_600_000_000_000n`
   - `NANOSECONDS_PER_MINUTE = 60_000_000_000n`
   - `NANOSECONDS_PER_SECOND`, `NANOSECONDS_PER_MILLISECOND` and `NANOSECONDS_PER_MICROSECOND`
     are imported from `./foreignEpochs`.
   - Define the hour and minute constants locally.
3. Call `Temporal.Duration.from({ hours, minutes, seconds, milliseconds, microseconds, nanoseconds })`
   with each field `Number(...)`-converted, then `.toString()`, all inside `try { } catch { return ""; }`.

Why this is safe:

- The largest value ever passed is the full Instant span, 1.728 × 10^22 ns = 4 800 000 000 h,
  which `Number` represents exactly. Verified: `PT4800000000H`.
- Every other field is < 3600.
- It never does `Number(total)`, which loses precision past 2^53. Verified:
  `Number(2n**53n + 1n) === Number(2n**53n)`.
- It never calls `Instant.fromEpochNanoseconds(0n).until(...)`, which throws `RangeError` for a
  span larger than the Instant range. Verified.

Why a separate helper: it keeps the D4 bigint arithmetic unit-testable against
`Instant.until({ largestUnit: "hour" })` on its own, and `sumIntervals` stays a three-line
function.

Add to `packages/gmt/src/internal/index.ts`:

```ts
export { formatHourDuration } from "./hourDurationString";
export {
  coalesceIntervalNanoseconds,
  type IntervalNanoseconds,
  parseIntervalNanoseconds,
  parseIntervalNanosecondsList,
} from "./intervalNanoseconds";
```

`clampInterval` calls `intersectIntervals` directly (D3: clamp = intersect(interval, bounds)).
No helper is needed.

---

## 2. Validation order and sentinels (D2)

Validation happens entirely before any work, and it is all-or-nothing. An invalid element
anywhere returns the sentinel, even one that could not affect the answer (for example, a removal
lying outside `from`).

| Function | Order | Sentinel |
| --- | --- | --- |
| `isValidInterval(interval)` | `parseIntervalNanoseconds(interval)` | `false` |
| `intervalsOverlap(a, b)` | parse `a`, parse `b` | `false` |
| `intervalContains(interval, isoString)` | parse `interval`; `parseInstantNanoseconds(isoString)` (non-string → null) | `false` |
| `intersectIntervals(a, b)` | parse `a`, parse `b` | `null` |
| `clampInterval(interval, bounds)` | delegates to `intersectIntervals(interval, bounds)` | `null` |
| `mergeIntervals(intervals)` | `parseIntervalNanosecondsList(intervals)` | `[]` |
| `subtractIntervals(from, remove)` | parse `from`; `parseIntervalNanosecondsList(remove)` | `[]` |
| `splitIntervalAt(interval, boundaries)` | parse `interval`; `Array.isArray(boundaries)`; `parseInstantNanoseconds` on every element | `[]` |
| `sumIntervals(intervals)` | `parseIntervalNanosecondsList(intervals)` | `""` |

**Invalid** covers:

- a non-object or `null` interval;
- a missing, non-string or empty `start`/`end`;
- a zoneless string, a bracket-only zone, or a date-only string;
- a leap second or a `[u-ca=]` annotation;
- an out-of-range instant;
- `start > end` by instant (not lexically);
- for lists: a non-array or any invalid element;
- for boundaries: a non-array or any element that is not a valid instant string.

**The `[]` collision** applies to `mergeIntervals`, `subtractIntervals` and `splitIntervalAt`.
`mergeIntervals([])`, `mergeIntervals([emptyInterval])` and a fully covered `subtractIntervals`
legitimately return `[]`. Each JSDoc says so and points to `isValidInterval`.
`splitIntervalAt` never returns `[]` for valid input; it returns at least one piece.

**Returned objects are always fresh `{ start, end }` literals.** They are never the caller's
objects, so tests use `toEqual`, plus a `not.toBe` check on one row.

---

## 3. Algorithms (bigint epoch ns; outputs from `*Text` only)

Notation: `A`, `B`, `F`, `R` are `IntervalNanoseconds`.

### Algorithm: `isValidInterval`

`parseIntervalNanoseconds(interval) !== null`.

### Algorithm: `intervalsOverlap` (D5)

`A.start < B.end && B.start < A.end`.

- Touching: `A.end === B.start` → false.
- Empty at an edge (`[9,9)` against `[9,17)`): `9 < 9` is false → false.
- Empty strictly inside: true.
- Two identical empty intervals: `12 < 12` is false → false.

### Algorithm: `intervalContains` (D1)

`A.start <= t && t < A.end`. For an empty interval this is always false.

### Algorithm: `intersectIntervals` (D3, D5)

1. If `!(A.start < B.end && B.start < A.end)`, return `null`. This is the overlap predicate
   itself, so `intervalsOverlap(a, b) ⇔ intersectIntervals(a, b) !== null` holds by construction.
2. `start = A.start >= B.start ? A.startText : B.startText`.
   `end = A.end <= B.end ? A.endText : B.endText`.
   The non-strict comparisons are what make the first argument win on ties.

**GMT rule reason:** outputs must be caller strings, and a positional rule is deterministic
without inventing a canonical spelling.

### Algorithm: `clampInterval`

`return intersectIntervals(interval, bounds)`. The interval is the first argument, so its strings
win ties.

- An interval touching `bounds`, or an empty interval at an edge of `bounds`, clamps to `null`.
- An empty interval strictly inside clamps to itself.

### Algorithm: `mergeIntervals` (D3, D5)

`coalesceIntervalNanoseconds(records).map(r => ({ start: r.startText, end: r.endText }))`.

### Algorithm: `subtractIntervals` (D3, D5)

```ts
const pieces: Interval[] = [];
let cursor = F.start;
let cursorText = F.startText;
for (const r of coalesceIntervalNanoseconds(removeRecords)) {   // sorted, disjoint, non-touching, non-empty
  if (cursor >= F.end) break;
  if (r.end <= cursor) continue;                // wholly before (or touching) the cursor
  if (r.start >= F.end) break;                  // wholly after (or touching) from.end
  if (r.start > cursor) pieces.push({ start: cursorText, end: r.startText });
  if (r.end > cursor) { cursor = r.end; cursorText = r.endText; }  // strict: from's text survives ties
}
if (cursor < F.end) pieces.push({ start: cursorText, end: F.endText });
return pieces;
```

- Empty removals are dropped or absorbed by the coalesce, so removing an empty interval changes
  nothing.
- Empty `from`: `cursor === F.end`, so the result is `[]`.
- Every emitted piece is non-empty (strict comparisons) and the pieces never touch.
- Piece endpoints come from `from` wherever `from` supplies that instant.

### Algorithm: `splitIntervalAt` (D3, D5)

1. Validate `interval` and every boundary. Keep `{ n, text }` per boundary.
2. `inside = boundaries.filter(p => I.start < p.n && p.n < I.end)`, stable-sorted by `n`.
3. `unique = inside.filter((p, k) => k === 0 || p.n !== inside[k - 1].n)`. The stable sort keeps
   the input's first occurrence first.
4. `texts = [I.startText, ...unique.map(p => p.text), I.endText]`, and the pieces are
   `texts[k] → texts[k + 1]`.
5. For an empty interval, `inside` is always empty, so the result is `[{ start, end }]`.

Pieces tile the interval half-open: each `end` is the next `start`, the pieces share no instant,
and together they cover every instant exactly once (EWD831 / SQL:2011 closed-open).

### Algorithm: `sumIntervals` (D4)

1. `list = parseIntervalNanosecondsList(intervals)`. If `null`, return `""`.
2. `total = coalesceIntervalNanoseconds(list).reduce((sum, r) => sum + (r.end - r.start), 0n)`.
3. `return formatHourDuration(total)`. An empty list gives `0n`, which formats as `PT0S`.

---

## 4. JSDoc drafts

Follow [jsdoc-standards](../../jsdoc-standards.md). Every example value below is verified (§6).
The phrase "the half-open standard" is used deliberately and consistently. **Do not cite peer
libraries.**

### JSDoc: `types/interval.ts`

```ts
/**
 * A span of time between two ISO 8601 instant strings, half-open: `[start, end)`.
 *
 * - An instant `t` is inside when `start ≤ t < end` (EWD831; SQL:2011 closed-open `PERIOD`;
 *   RFC 5545 `DTEND` is non-inclusive). Intervals that touch share no instant.
 * - Both endpoints are instants: an offset (`Z`, `±HH:MM`) is required, a bracketed IANA zone is
 *   optional, and the two may name different zones. Leap seconds and `[u-ca=...]` are rejected.
 * - `start === end` (as instants) is a valid, empty interval: it has a position but contains no
 *   instant. `start` after `end` is invalid.
 *
 * Narrow a candidate with `isValidInterval`. Used by the `interval/` namespace; the older
 * `plain|utc|zoned|unix/interval` functions take positional strings and a different model.
 */
export type Interval = { start: string; end: string };
```

### JSDoc: `isValidInterval`

```ts
/**
 * Validate whether a value is an `Interval` the `interval/` namespace accepts.
 *
 * - True when `start` and `end` are ISO 8601 instant strings (offset required, optional
 *   bracketed zone, no leap second, no `[u-ca=...]`) and `start` is not after `end`.
 * - Compares instants, not text: `{ start: "2024-01-01T10:00:00+01:00", end: "2024-01-01T09:30:00Z" }`
 *   is valid even though it sorts backwards as a string.
 * - `start === end` is valid — an empty interval.
 * - Use it to tell a legitimate `[]` from `mergeIntervals`, `subtractIntervals` or
 *   `splitIntervalAt` apart from their invalid-input sentinel, which is also `[]`.
 * - Returns `false` for non-objects, `null`, and records whose `start`/`end` are not strings.
 *
 * @param interval candidate `{ start, end }` record of ISO 8601 instant strings
 * @returns boolean indicating whether every `interval/` function accepts it
 *
 * @example isValidInterval({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }) // true
 * @example isValidInterval({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T09:00:00Z" }) // true — empty
 * @example isValidInterval({ start: "2024-01-01T10:00:00+01:00", end: "2024-01-01T09:30:00Z" }) // true — 09:00Z to 09:30Z
 * @example isValidInterval({ start: "2024-01-01T17:00:00Z", end: "2024-01-01T09:00:00Z" }) // false — inverted
 * @example isValidInterval({ start: "2024-01-01T09:00:00", end: "2024-01-01T17:00:00Z" }) // false — no offset
 * @example isValidInterval({ start: "2016-12-31T23:59:60Z", end: "2017-01-01T00:00:00Z" }) // false — leap second
 */
```

### JSDoc: `intervalsOverlap`

```ts
/**
 * Return true when two half-open intervals share at least one instant.
 *
 * - `a.start < b.end && b.start < a.end`. Touching intervals (`a.end` is `b.start`) do not
 *   overlap: under `[start, end)` the shared endpoint belongs only to the later interval.
 * - True exactly when `intersectIntervals(a, b)` is not `null`.
 * - An empty interval (`start === end`) overlaps an interval it lies strictly inside, and nothing
 *   else — not at an edge, not another empty interval at the same instant (GMT rule: an empty
 *   interval covers no time, so only a strictly interior position is shared).
 * - Compares instants: endpoints may name different zones.
 * - The closed `intervalsOverlapUtc`, `intervalsOverlapZoned`, `intervalsOverlapDate` (…) return
 *   `true` for touching intervals; this is the half-open standard.
 * - For zone-aligned windows (a local day, a trading session), build the endpoints with
 *   `floorToZone` first.
 * - Returns `false` on invalid input — either interval not an `Interval`, or inverted.
 *
 * @param a `{ start, end }` record of ISO 8601 instant strings
 * @param b `{ start, end }` record of ISO 8601 instant strings
 * @returns true if the intervals share an instant, or false on invalid input
 *
 * @example intervalsOverlap({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, { start: "2024-01-01T12:00:00Z", end: "2024-01-01T18:00:00Z" }) // true
 * @example intervalsOverlap({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, { start: "2024-01-01T17:00:00Z", end: "2024-01-01T18:00:00Z" }) // false — touching
 * @example intervalsOverlap({ start: "2024-01-01T12:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }) // true — empty, strictly inside
 * @example intervalsOverlap({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T09:00:00Z" }, { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }) // false — empty, at the edge
 * @example intervalsOverlap({ start: "2024-01-01T17:00:00Z", end: "2024-01-01T09:00:00Z" }, { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }) // false — inverted
 */
```

### JSDoc: `intervalContains`

```ts
/**
 * Return true when an ISO 8601 instant string lies inside a half-open interval.
 *
 * - `start ≤ t < end`: `start` is inside, `end` is not.
 * - Always `false` for an empty interval (`start === end`) — it contains no instant.
 * - Compares instants: `isoString` may name a different zone from either endpoint.
 * - The closed `intervalContainsUtc`, `intervalContainsZoned` (…) include `end`; this is the
 *   half-open standard.
 * - Returns `false` on invalid input — `interval` not an `Interval`, or `isoString` not an
 *   instant string (offset required, no leap second, no `[u-ca=...]`).
 *
 * @param interval `{ start, end }` record of ISO 8601 instant strings
 * @param isoString ISO 8601 instant string to test
 * @returns true if the instant is inside the interval, or false on invalid input
 *
 * @example intervalContains({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, "2024-01-01T09:00:00Z") // true — start is inside
 * @example intervalContains({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, "2024-01-01T17:00:00Z") // false — end is not
 * @example intervalContains({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, "2024-01-01T04:00:00-05:00") // true — same instant as start
 * @example intervalContains({ start: "2024-01-01T12:00:00Z", end: "2024-01-01T12:00:00Z" }, "2024-01-01T12:00:00Z") // false — empty interval
 * @example intervalContains({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, "2024-01-01T12:00:00") // false — no offset
 */
```

### JSDoc: `intersectIntervals`

```ts
/**
 * Return the half-open interval two intervals share, or null when they share no instant.
 *
 * - Non-null exactly when `intervalsOverlap(a, b)` is true: touching intervals return `null`.
 * - An empty interval strictly inside the other is returned as the intersection.
 * - Endpoints are the caller's own strings, never re-serialised. When `a` and `b` spell the same
 *   instant differently, `a`'s spelling is used (GMT rule: the first argument wins ties).
 * - The closed `intervalIntersectionUtc` (…) returns a one-instant span for touching intervals;
 *   this is the half-open standard.
 * - Returns `null` on invalid input — either interval not an `Interval`, or inverted.
 *
 * @param a `{ start, end }` record of ISO 8601 instant strings; its strings win ties
 * @param b `{ start, end }` record of ISO 8601 instant strings
 * @returns `{ start, end }` of the shared span, or null when disjoint, touching, or on invalid input
 *
 * @example intersectIntervals({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, { start: "2024-01-01T12:00:00Z", end: "2024-01-01T18:00:00Z" }) // { start: "2024-01-01T12:00:00Z", end: "2024-01-01T17:00:00Z" }
 * @example intersectIntervals({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, { start: "2024-01-01T17:00:00Z", end: "2024-01-01T18:00:00Z" }) // null — touching
 * @example intersectIntervals({ start: "2024-01-01T04:00:00-05:00", end: "2024-01-01T12:00:00-05:00" }, { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }) // { start: "2024-01-01T04:00:00-05:00", end: "2024-01-01T12:00:00-05:00" } — same instants, first argument's spelling
 * @example intersectIntervals({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T13:00:00Z", end: "2024-01-01T17:00:00Z" }) // null — disjoint
 * @example intersectIntervals({ start: "invalid", end: "2024-01-01T17:00:00Z" }, { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }) // null
 */
```

### JSDoc: `clampInterval`

```ts
/**
 * Return the part of `interval` that lies inside `bounds`, or null when none of it does.
 *
 * - Exactly `intersectIntervals(interval, bounds)`: half-open, so an interval that only touches
 *   `bounds` clamps to `null`, as does an empty interval at an edge of `bounds`.
 * - Endpoints are the caller's own strings. Where an endpoint of `interval` and of `bounds` are
 *   the same instant, `interval`'s spelling is used (GMT rule: the first argument wins ties).
 * - For zone-aligned bounds (a local business day), build them with `floorToZone` first.
 * - Returns `null` on invalid input — either argument not an `Interval`, or inverted.
 *
 * @param interval `{ start, end }` record of ISO 8601 instant strings to clamp; its strings win ties
 * @param bounds `{ start, end }` record of ISO 8601 instant strings to clamp into
 * @returns `{ start, end }` inside `bounds`, or null when nothing remains or on invalid input
 *
 * @example clampInterval({ start: "2024-01-01T08:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }) // { start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }
 * @example clampInterval({ start: "2024-01-01T06:00:00Z", end: "2024-01-01T20:00:00Z" }, { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }) // { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }
 * @example clampInterval({ start: "2024-01-01T17:00:00Z", end: "2024-01-01T18:00:00Z" }, { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }) // null — touching
 * @example clampInterval({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T09:00:00Z" }, { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }) // null — empty, at the edge
 * @example clampInterval({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, { start: "2024-01-01T17:00:00Z", end: "2024-01-01T09:00:00Z" }) // null — inverted bounds
 */
```

### JSDoc: `mergeIntervals`

```ts
/**
 * Collapse a list of half-open intervals into the fewest sorted, non-overlapping intervals.
 *
 * - Overlapping and touching intervals (`a.end` is `b.start`) coalesce: `[09, 12) ∪ [12, 17)`
 *   is `[09, 17)`. Intervals one nanosecond apart do not.
 * - Input order does not matter; the result is sorted by start, and no two results touch.
 * - Empty intervals (`start === end`) cover no time: one that touches or lies inside a run is
 *   absorbed, one that touches nothing is dropped (GMT rule).
 * - Endpoints are the caller's own strings. A run keeps the start of its first interval (by
 *   instant, then input order) and the end of the first interval to reach its latest end
 *   (GMT rule: first wins ties between spellings of one instant).
 * - `[]` is both a legitimate result (an empty list, or a list of only empty intervals) and the
 *   invalid-input sentinel; check inputs with `isValidInterval` when the difference matters.
 * - The closed `mergeIntervalsUtc`, `mergeIntervalsZoned` (…) also merge touching intervals but
 *   re-serialise endpoints; this is the half-open standard.
 * - Returns `[]` when `intervals` is not an array or any element is not a valid `Interval`.
 *
 * @param intervals array of `{ start, end }` records of ISO 8601 instant strings
 * @returns sorted, disjoint, non-touching `{ start, end }` records, or [] on invalid input
 *
 * @example mergeIntervals([{ start: "2024-01-01T13:00:00Z", end: "2024-01-01T17:00:00Z" }, { start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }]) // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T13:00:00Z", end: "2024-01-01T17:00:00Z" }]
 * @example mergeIntervals([{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T12:00:00Z", end: "2024-01-01T17:00:00Z" }]) // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }] — touching
 * @example mergeIntervals([{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T10:00:00Z" }, { start: "2024-01-01T12:00:00Z", end: "2024-01-01T12:00:00Z" }]) // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T10:00:00Z" }] — stranded empty dropped
 * @example mergeIntervals([]) // []
 * @example mergeIntervals([{ start: "2024-01-01T17:00:00Z", end: "2024-01-01T09:00:00Z" }]) // [] — inverted
 */
```

### JSDoc: `subtractIntervals`

```ts
/**
 * Return the parts of `from` that no interval in `remove` covers, as sorted half-open intervals.
 *
 * - A removal strictly inside `from` splits it in two; one covering an edge trims it; one
 *   covering all of it leaves `[]`.
 * - Half-open: a removal that only touches `from` removes nothing, and pieces never include an
 *   instant any removal covers.
 * - `remove` may be unsorted and overlapping. Removing an empty interval changes nothing;
 *   subtracting from an empty `from` returns `[]`.
 * - Endpoints are the caller's own strings, and `from`'s spelling is kept wherever `from` and a
 *   removal name the same instant (GMT rule).
 * - `[]` is both a legitimate result (everything removed) and the invalid-input sentinel; check
 *   inputs with `isValidInterval` when the difference matters.
 * - The closed `intervalDifferenceUtc` (…) steps pieces 1 ns in from each removal; this is the
 *   half-open standard, where pieces end exactly where a removal starts.
 * - For zone-aligned removals (non-working local days), build them with `floorToZone` first.
 * - Returns `[]` when `from` is not a valid `Interval`, `remove` is not an array, or any element
 *   of `remove` is not a valid `Interval` — even one outside `from`.
 *
 * @param from `{ start, end }` record of ISO 8601 instant strings to subtract from
 * @param remove array of `{ start, end }` records of ISO 8601 instant strings to remove
 * @returns sorted, non-touching `{ start, end }` records of what remains, or [] on invalid input
 *
 * @example subtractIntervals({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, [{ start: "2024-01-01T12:00:00Z", end: "2024-01-01T13:00:00Z" }]) // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T13:00:00Z", end: "2024-01-01T17:00:00Z" }]
 * @example subtractIntervals({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, [{ start: "2024-01-01T17:00:00Z", end: "2024-01-01T18:00:00Z" }]) // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }] — touching
 * @example subtractIntervals({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, [{ start: "2024-01-01T08:00:00Z", end: "2024-01-01T18:00:00Z" }]) // [] — fully covered
 * @example subtractIntervals({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, []) // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }]
 * @example subtractIntervals({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, [{ start: "2024-01-01T12:00:00Z", end: "2016-12-31T23:59:60Z" }]) // [] — invalid removal
 */
```

### JSDoc: `splitIntervalAt`

```ts
/**
 * Split a half-open interval at instant boundaries into consecutive half-open pieces.
 *
 * - Each piece's `end` is the next piece's `start`; under `[start, end)` the pieces share no
 *   instant and together cover the interval exactly once.
 * - `boundaries` may be unsorted. Boundaries at or outside the interval's edges are dropped, so
 *   no piece is empty; duplicate instants keep their first occurrence's spelling (GMT rule).
 * - Endpoints are the caller's own strings: the interval's own `start`/`end`, and each boundary
 *   exactly as passed.
 * - Splitting an empty interval returns it unchanged, as a single piece.
 * - Never returns `[]` for valid input — that is the invalid-input sentinel alone.
 * - To split at zone-aligned boundaries (local midnights), build them with `floorToZone` or
 *   `bucketRange` first.
 * - Returns `[]` when `interval` is not a valid `Interval`, `boundaries` is not an array, or any
 *   boundary is not an ISO 8601 instant string — even one outside the interval.
 *
 * @param interval `{ start, end }` record of ISO 8601 instant strings to split
 * @param boundaries array of ISO 8601 instant strings to split at
 * @returns consecutive `{ start, end }` pieces covering `interval`, or [] on invalid input
 *
 * @example splitIntervalAt({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, ["2024-01-01T12:00:00Z"]) // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T12:00:00Z", end: "2024-01-01T17:00:00Z" }]
 * @example splitIntervalAt({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, ["2024-01-01T15:00:00Z", "2024-01-01T11:00:00Z"]) // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T11:00:00Z" }, { start: "2024-01-01T11:00:00Z", end: "2024-01-01T15:00:00Z" }, { start: "2024-01-01T15:00:00Z", end: "2024-01-01T17:00:00Z" }]
 * @example splitIntervalAt({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, ["2024-01-01T09:00:00Z", "2024-01-01T18:00:00Z"]) // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }] — edge and outside dropped
 * @example splitIntervalAt({ start: "2024-01-01T12:00:00Z", end: "2024-01-01T12:00:00Z" }, ["2024-01-01T12:00:00Z"]) // [{ start: "2024-01-01T12:00:00Z", end: "2024-01-01T12:00:00Z" }] — empty interval
 * @example splitIntervalAt({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, ["2024-01-01T12:00:00"]) // [] — no offset
 */
```

### JSDoc: `sumIntervals`

```ts
/**
 * Return the time covered by a list of half-open intervals, as an exact ISO 8601 duration.
 *
 * - Covered time is the length of the union: overlapping time counts once, touching intervals
 *   add up, empty intervals add nothing.
 * - Hours are the largest unit, exactly as `Temporal.Instant.prototype.until` with
 *   `largestUnit: "hour"` renders it — an instant has no calendar, so there are no days.
 *   `PT49H30M`, not `P2DT1H30M`.
 * - Exact to the nanosecond at any size, including past 2^53 nanoseconds (about 104 days) and
 *   across the whole representable instant range (`PT4800000000H`).
 * - Measures elapsed time, never wall-clock distance: a New York day across spring-forward is
 *   `PT23H`.
 * - `[]` returns `"PT0S"` — no time covered, not invalid input.
 * - Returns `""` when `intervals` is not an array or any element is not a valid `Interval`.
 *
 * @param intervals array of `{ start, end }` records of ISO 8601 instant strings
 * @returns ISO 8601 duration string of the covered time, or "" on invalid input
 *
 * @example sumIntervals([{ start: "2024-01-01T00:00:00Z", end: "2024-01-03T01:30:00Z" }]) // "PT49H30M"
 * @example sumIntervals([{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T13:00:00Z" }, { start: "2024-01-01T12:00:00Z", end: "2024-01-01T17:00:00Z" }]) // "PT8H" — overlap counted once
 * @example sumIntervals([{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T00:00:01.5Z" }]) // "PT1.5S"
 * @example sumIntervals([]) // "PT0S"
 * @example sumIntervals([{ start: "2024-01-01T17:00:00Z", end: "2024-01-01T09:00:00Z" }]) // ""
 */
```

---

## 5. Namespace wiring

1. `packages/gmt/src/types/interval.ts` (new).
   `packages/gmt/src/types/index.ts`: `export * from "./interval";` between `./fractional-digit`
   and `./now-unit`.
2. `packages/gmt/src/interval/validate/index.ts`: `export * from "./isValidInterval";`
3. `packages/gmt/src/interval/compare/index.ts`: `export * from "./intervalContains";` and
   `export * from "./intervalsOverlap";`
4. `packages/gmt/src/interval/calculate/index.ts`, alphabetical: `clampInterval`,
   `intersectIntervals`, `mergeIntervals`, `splitIntervalAt`, `subtractIntervals`, `sumIntervals`.
5. `packages/gmt/src/interval/index.ts`: `export * from "./calculate";`,
   `export * from "./compare";`, `export * from "./validate";`
6. `packages/gmt/src/index.ts`: `export * from "./interval";` after `export * from "./instant";`
7. `packages/gmt/package.json` `exports`: insert after `"./instant/*/*": null`:

   ```json
   "./interval": { "types": "./dist/interval/index.d.ts", "default": "./dist/interval/index.js" },
   "./interval/*": { "types": "./dist/interval/*/index.d.ts", "default": "./dist/interval/*/index.js" },
   "./interval/*/*": null,
   ```

8. `apps/dox/src/lib/gmt-modules.ts`: a new `// --- interval ---` block after `// --- calendar ---`
   with `"interval/calculate"`, `"interval/compare"` and `"interval/validate"`, each
   `() => import("@northguild/gmt/interval/<sub>")`.
9. `packages/gmt/src/internal/index.ts`: the two helper exports in §1.2.
10. Finalizer: `packages/gmt/src/interval/README.md` stub, matching `calendar/README.md`
    (`# Interval API` + a reference link).

---

## 6. Edge-case test matrix

**Conventions:**

- `it.each` template tables, one category per table, with names interpolating the distinguishing
  variables.
- `Z(hh:mm:ss)` below abbreviates `"2024-01-01Thh:mm:ssZ"`. **Write the full literal in tests.**
  The date is `unix2024Jan01T000000Ms`; times of day are an override, needed because interval
  boundaries are the scenario.
- **Spelling-tie fixtures** name the same instants as `Z(09)`, `Z(12)` and `Z(17)`:
  - `NY9 = "2024-01-01T04:00:00-05:00"`
  - `NY12 = "2024-01-01T07:00:00-05:00"`
  - `NY17 = "2024-01-01T12:00:00-05:00"`
- **Output identity:** rows that pin a tie also assert `result.start === <input string>`. `toEqual`
  already compares the strings, but the `===` states the D3 intent.
- `A = { start: Z(09:00:00), end: Z(17:00:00) }`.

### 6.1 Shared invalid-input rows

Every function has one table built from this list, with the function's sentinel. Each `bad`
value is used as an interval argument, or as a list element for the list functions.

| Case | Value |
| --- | --- |
| non-object interval | `null`, `undefined`, `"x"`, `123`, `[]` — collapse into one row per the index.md rule |
| empty record / missing end | `{}`, `{ start: Z(09:00:00) }` |
| non-string endpoint | `{ start: 1, end: Z(09:00:00) }` |
| inverted | `{ start: Z(17:00:00), end: Z(09:00:00) }` |
| inverted by instant, ascending as text | `{ start: Z(09:30:00), end: "2024-01-01T10:00:00+01:00" }` |
| leap second | `{ start: "2016-12-31T23:59:60Z", end: "2017-01-01T00:00:00Z" }` |
| `[u-ca=]` | `{ start: "2024-01-01T09:00:00Z[u-ca=iso8601]", end: Z(17:00:00) }` |
| zoneless | `{ start: "2024-01-01T09:00:00", end: Z(17:00:00) }` |
| bracket-only zone | `{ start: "2024-01-01T09:00:00[UTC]", end: Z(17:00:00) }` |
| date only | `{ start: "2024-01-01", end: Z(17:00:00) }` |
| past Instant range | `{ start: "-271821-04-20T00:00:00Z", end: "+275760-09-13T00:00:00.000000001Z" }` |

All of these gave `isValidInterval → false` in the reference run. Also:

- **List functions** add three rows: non-array (`"x"`, `null`, `{}`), a `null` element
  (`[A, null]`), and one invalid element among valid ones (`[A, inverted]`). Verified: `[]`
  from merge, `""` from sum.
- **`intervalContains`** adds the point cases: `123`, `"2024-01-01T12:00:00"` and
  `"2016-12-31T23:59:60Z"`, each → `false`.
- **`splitIntervalAt`** adds: `boundaries` not an array; an element that is non-numeric-string
  (`123`), zoneless, or a leap second (placed outside the interval) → `[]` (verified).

### 6.2 `isValidInterval` (verified)

| interval | expected |
| --- | --- |
| `A` | `true` |
| `{ Z(09:00:00), Z(09:00:00) }` empty | `true` |
| `{ NY9, Z(09:00:00) }` same instant, different spelling | `true` |
| `{ "2024-01-01T10:00:00+01:00", Z(09:30:00) }` descending as text, ascending as instants | `true` |
| `{ "-271821-04-20T00:00:00Z", "+275760-09-13T00:00:00Z" }` full range | `true` |
| `{ "2024-01-01T10:00:00+01:00[America/New_York]", Z(09:00:00) }` offset disagrees with zone | `true` — `Temporal.Instant.from` uses the offset and ignores the annotation; pin it so a future grammar change is deliberate |
| §6.1 rows | `false` |

**Battle matrix:** for each `c` of `sameInstantBattleCases` (20 zones; all parse to the same
epoch ns — verified), `isValidInterval({ start: c.value, end: c.utc })` → `true`.

### 6.3 `intervalsOverlap` and `intersectIntervals` (verified; one table can drive both)

| case | a | b | overlap | intersect |
| --- | --- | --- | --- | --- |
| partial | `A` | `{Z(12:00:00), Z(18:00:00)}` | `true` | `{ start: Z(12:00:00), end: Z(17:00:00) }` |
| touching | `A` | `{Z(17:00:00), Z(18:00:00)}` | `false` | `null` |
| touching, reversed | `{Z(17:00:00), Z(18:00:00)}` | `A` | `false` | `null` |
| disjoint | `{Z(09:00:00), Z(12:00:00)}` | `{Z(13:00:00), Z(17:00:00)}` | `false` | `null` |
| containment | `A` | `{Z(10:00:00), Z(11:00:00)}` | `true` | `{ Z(10:00:00), Z(11:00:00) }` |
| identical, different spelling | `A` | `{NY9, NY17}` | `true` | `{ start: Z(09:00:00), end: Z(17:00:00) }` (a's) |
| same, swapped | `{NY9, NY17}` | `A` | `true` | `{ start: NY9, end: NY17 }` (a's) |
| same start tie | `A` | `{NY9, Z(12:00:00)}` | `true` | `{ start: Z(09:00:00), end: Z(12:00:00) }` |
| empty at start edge | `{Z(09:00:00), Z(09:00:00)}` | `A` | `false` | `null` |
| empty at end edge | `{Z(17:00:00), Z(17:00:00)}` | `A` | `false` | `null` |
| empty inside | `{Z(12:00:00), Z(12:00:00)}` | `A` | `true` | `{ Z(12:00:00), Z(12:00:00) }` |
| empty inside, swapped | `A` | `{Z(12:00:00), Z(12:00:00)}` | `true` | `{ Z(12:00:00), Z(12:00:00) }` |
| identical empties | `{Z(12:00:00), Z(12:00:00)}` | `{NY12, NY12}` | `false` | `null` |
| 1 ns overlap | `{Z(09:00:00), Z(12:00:00.000000001)}` | `{Z(12:00:00), Z(17:00:00)}` | `true` | `{ start: Z(12:00:00), end: Z(12:00:00.000000001) }` |
| mixed zones | `{ "2024-01-01T09:00:00-05:00[America/New_York]", "2024-01-01T18:00:00+01:00[Europe/Berlin]" }` | `{ Z(15:00:00), "2024-01-02T03:00:00+09:00[Asia/Tokyo]" }` | `true` | `{ start: Z(15:00:00), end: "2024-01-01T18:00:00+01:00[Europe/Berlin]" }` |
| inverted a | `{Z(17:00:00), Z(09:00:00)}` | `A` | `false` | `null` |

**Property (overlap ⇔ intersect non-null).** Enumerate every interval over the points
`[Z(09:00:00), NY12, Z(12:00:00), Z(12:00:00.000000001), Z(17:00:00)]` with `start ≤ end` by
instant. That gives 14 intervals, including the empty ones. For all 196 ordered pairs, assert:

- `intervalsOverlap(a, b) === (intersectIntervals(a, b) !== null)`;
- `intervalsOverlap(a, b) === intervalsOverlap(b, a)`.

This is a deterministic enumeration; no property-testing library is a dependency.

**Battle matrix:** with `later = "2024-02-29T01:00:00Z"`, for each `c`:

- `intersectIntervals({ start: c.utc, end: later }, { start: c.value, end: later }).start === c.utc`
  and swapped `=== c.value`;
- `intervalsOverlap({ start: c.value, end: c.value }, { start: c.utc, end: later })` → `false`
  (empty at the edge).

### 6.4 `intervalContains` (verified)

| interval | isoString | expected |
| --- | --- | --- |
| `A` | `Z(12:00:00)` | `true` |
| `A` | `Z(09:00:00)` (start) | `true` |
| `A` | `Z(17:00:00)` (end) | `false` |
| `A` | `Z(08:59:59.999999999)` | `false` |
| `A` | `Z(16:59:59.999999999)` | `true` |
| `A` | `NY9` (= start) | `true` |
| `A` | `NY17` (= end) | `false` |
| `{Z(12:00:00), Z(12:00:00)}` | `Z(12:00:00)` | `false` |
| full range | `"-271821-04-20T00:00:00Z"` | `true` |
| full range | `"+275760-09-13T00:00:00Z"` | `false` |

**Battle matrix:** `intervalContains({ start: c.value, end: "2024-02-29T01:00:00Z" }, c.utc)` →
`true`, and `intervalContains({ start: c.utc, end: c.value }, c.utc)` → `false` (empty interval).

### 6.5 `clampInterval` (verified; bounds = `A`)

| interval | expected |
| --- | --- |
| `{Z(08:00:00), Z(12:00:00)}` | `{ start: Z(09:00:00), end: Z(12:00:00) }` |
| `{Z(10:00:00), Z(11:00:00)}` | `{ Z(10:00:00), Z(11:00:00) }` (unchanged) |
| `{Z(06:00:00), Z(20:00:00)}` | `{ Z(09:00:00), Z(17:00:00) }` |
| `{Z(17:00:00), Z(18:00:00)}` touching | `null` |
| `{Z(05:00:00), Z(06:00:00)}` outside | `null` |
| `{Z(09:00:00), Z(09:00:00)}` empty at edge | `null` |
| `{Z(12:00:00), Z(12:00:00)}` empty inside | `{ Z(12:00:00), Z(12:00:00) }` |
| `{NY9, NY17}` equal, different spelling | `{ start: NY9, end: NY17 }` (interval's) |

Add a row with invalid `bounds` → `null`, and a spy row asserting that
`clampInterval(i, b)` deep-equals `intersectIntervals(i, b)` across the §6.3 pairs.

### 6.6 `mergeIntervals` (verified; the `sumIntervals` of each input is shown for §6.8 reuse)

| case | input | expected | sum |
| --- | --- | --- | --- |
| empty list | `[]` | `[]` | `PT0S` |
| unsorted | `[{Z(13:00:00),Z(17:00:00)}, {Z(09:00:00),Z(12:00:00)}]` | `[{Z(09:00:00),Z(12:00:00)}, {Z(13:00:00),Z(17:00:00)}]` | `PT7H` |
| touching | `[{Z(09:00:00),Z(12:00:00)}, {Z(12:00:00),Z(17:00:00)}]` | `[{Z(09:00:00),Z(17:00:00)}]` | `PT8H` |
| overlapping | `[{Z(09:00:00),Z(13:00:00)}, {Z(12:00:00),Z(17:00:00)}]` | `[{Z(09:00:00),Z(17:00:00)}]` | `PT8H` |
| contained | `[A, {Z(10:00:00),Z(11:00:00)}]` | `[A]` | `PT8H` |
| 1 ns gap | `[{Z(09:00:00),Z(12:00:00)}, {Z(12:00:00.000000001),Z(17:00:00)}]` | unchanged, 2 runs | `PT7H59M59.999999999S` |
| chain, unsorted | `[{Z(15:00:00),Z(17:00:00)}, {Z(09:00:00),Z(12:00:00)}, {Z(12:00:00),Z(15:00:00)}]` | `[A]` | `PT8H` |
| empty inside | `[A, {Z(12:00:00),Z(12:00:00)}]` | `[A]` | `PT8H` |
| empty touching end | `[{Z(09:00:00),Z(12:00:00)}, {NY12,NY12}]` | `[{ start: Z(09:00:00), end: Z(12:00:00) }]` | `PT3H` |
| empty touching start (listed first) | `[{NY12,NY12}, {Z(12:00:00),Z(17:00:00)}]` | `[{ start: NY12, end: Z(17:00:00) }]` | `PT5H` |
| empty touching start (listed second) | `[{Z(12:00:00),Z(17:00:00)}, {NY12,NY12}]` | `[{ start: Z(12:00:00), end: Z(17:00:00) }]` | `PT5H` |
| stranded empty | `[{Z(09:00:00),Z(10:00:00)}, {Z(12:00:00),Z(12:00:00)}]` | `[{Z(09:00:00),Z(10:00:00)}]` | `PT1H` |
| only empty | `[{Z(12:00:00),Z(12:00:00)}]` | `[]` (collision) | `PT0S` |
| identical empties | `[{Z(12:00:00),Z(12:00:00)}, {NY12,NY12}]` | `[]` | `PT0S` |
| duplicate, different spelling | `[A, {NY9,NY17}]` | `[{ start: Z(09:00:00), end: Z(17:00:00) }]` | `PT8H` |
| same start, different spelling | `[{Z(09:00:00),Z(12:00:00)}, {NY9,Z(17:00:00)}]` | `[{ start: Z(09:00:00), end: Z(17:00:00) }]` | `PT8H` |
| end tie | `[A, {Z(10:00:00),NY17}]` | `[{ start: Z(09:00:00), end: Z(17:00:00) }]` | `PT8H` |

Also assert `mergeIntervals([A])[0]` is `not.toBe(A)` (fresh object).

**Battle matrix:**
`mergeIntervals([{ start: c.value, end: "2024-02-29T01:00:00Z" }, { start: c.utc, end: "2024-02-29T02:00:00Z" }])`
→ `[{ start: c.value, end: "2024-02-29T02:00:00Z" }]`.

### 6.7 `subtractIntervals` (verified; from = `A` unless stated)

| case | remove | expected |
| --- | --- | --- |
| none | `[]` | `[A]` |
| interior | `[{Z(12:00:00),Z(13:00:00)}]` | `[{Z(09:00:00),Z(12:00:00)}, {Z(13:00:00),Z(17:00:00)}]` |
| left edge | `[{Z(08:00:00),Z(10:00:00)}]` | `[{Z(10:00:00),Z(17:00:00)}]` |
| right edge | `[{Z(16:00:00),Z(18:00:00)}]` | `[{Z(09:00:00),Z(16:00:00)}]` |
| full cover | `[{Z(08:00:00),Z(18:00:00)}]` | `[]` |
| exact, different spelling | `[{NY9,NY17}]` | `[]` |
| touching after | `[{Z(17:00:00),Z(18:00:00)}]` | `[A]` |
| touching before | `[{Z(08:00:00),Z(09:00:00)}]` | `[A]` |
| disjoint | `[{Z(18:00:00),Z(19:00:00)}]` | `[A]` |
| empty removal inside | `[{Z(12:00:00),Z(12:00:00)}]` | `[A]` |
| empty removal at edge | `[{Z(09:00:00),Z(09:00:00)}]` | `[A]` |
| empty from, none (from `{Z(12:00:00),Z(12:00:00)}`) | `[]` | `[]` |
| empty from, covering (same from) | `[{Z(10:00:00),Z(14:00:00)}]` | `[]` |
| several, unsorted, overlapping | `[{Z(14:00:00),Z(15:00:00)}, {Z(10:00:00),Z(11:00:00)}, {Z(10:30:00),Z(12:00:00)}]` | `[{Z(09:00:00),Z(10:00:00)}, {Z(12:00:00),Z(14:00:00)}, {Z(15:00:00),Z(17:00:00)}]` |
| touching removals | `[{Z(10:00:00),Z(12:00:00)}, {Z(12:00:00),Z(13:00:00)}]` | `[{Z(09:00:00),Z(10:00:00)}, {Z(13:00:00),Z(17:00:00)}]` |
| removal ends at from.start, different spelling | `[{Z(08:00:00),NY9}]` | `[{ start: Z(09:00:00), end: Z(17:00:00) }]` (from's) |
| removal starts at from.end, different spelling | `[{NY17,Z(18:00:00)}]` | `[{ start: Z(09:00:00), end: Z(17:00:00) }]` (from's) |
| removal starts at from.start, different spelling | `[{NY9,Z(10:00:00)}]` | `[{ start: Z(10:00:00), end: Z(17:00:00) }]` |
| removal ends at from.end, different spelling | `[{Z(16:00:00),NY17}]` | `[{ start: Z(09:00:00), end: Z(16:00:00) }]` (from's end) |
| 1 ns removal | `[{Z(12:00:00),Z(12:00:00.000000001)}]` | `[{Z(09:00:00),Z(12:00:00)}, {Z(12:00:00.000000001),Z(17:00:00)}]` |
| mixed zones | `[{ "2024-01-01T11:00:00+01:00[Europe/Berlin]", "2024-01-01T20:00:00+09:00[Asia/Tokyo]" }]` | `[{ start: Z(09:00:00), end: "2024-01-01T11:00:00+01:00[Europe/Berlin]" }, { start: "2024-01-01T20:00:00+09:00[Asia/Tokyo]", end: Z(17:00:00) }]` |
| invalid removal (leap second) | `[{Z(12:00:00), "2016-12-31T23:59:60Z"}]` | `[]` |

### 6.8 `sumIntervals` (verified)

| case | input | expected |
| --- | --- | --- |
| empty list | `[]` | `"PT0S"` |
| 49 h 30 m | `[{ "2024-01-01T00:00:00Z", "2024-01-03T01:30:00Z" }]` | `"PT49H30M"` |
| 24 h | `[{ "2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z" }]` | `"PT24H"` |
| 1.5 s | `[{ "2024-01-01T00:00:00Z", "2024-01-01T00:00:01.5Z" }]` | `"PT1.5S"` |
| + 1 ns | `[{ "2024-01-01T00:00:00Z", "2024-01-03T01:30:00.000000001Z" }]` | `"PT49H30M0.000000001S"` |
| 1 µs | `[{ Z(00:00:00), Z(00:00:00.000001) }]` | `"PT0.000001S"` |
| minute + centiseconds | `[{ Z(00:00:00), Z(00:01:00.01) }]` | `"PT1M0.01S"` |
| overlap counted once | `[{Z(09:00:00),Z(13:00:00)}, {Z(12:00:00),Z(17:00:00)}]` | `"PT8H"` |
| touching | `[{Z(09:00:00),Z(12:00:00)}, {Z(12:00:00),Z(17:00:00)}]` | `"PT8H"` |
| disjoint | `[{Z(09:00:00),Z(10:00:00)}, {Z(12:00:00),Z(13:00:00)}]` | `"PT2H"` |
| only empty | `[{Z(12:00:00),Z(12:00:00)}]` | `"PT0S"` |
| DST, New York spring-forward | `[{ "2024-03-09T12:00:00-05:00[America/New_York]", "2024-03-10T12:00:00-04:00[America/New_York]" }]` | `"PT23H"` |
| past 2^53 ns | `[{ "2024-01-01T00:00:00Z", "2024-04-15T08:00:00.000000001Z" }]` (9 100 800 000 000 001 ns) | `"PT2528H0.000000001S"` |
| two disjoint, total past 2^53 | `[{ "2024-01-01T00:00:00Z", "2024-02-15T00:00:00Z" }, { "2024-03-01T00:00:00Z", "2024-04-30T00:00:00.000000001Z" }]` | `"PT2520H0.000000001S"` |
| full Instant range | `[{ "-271821-04-20T00:00:00Z", "+275760-09-13T00:00:00Z" }]` | `"PT4800000000H"` |
| full range + overlapping half | `[full, { "1970-01-01T00:00:00Z", "+275760-09-13T00:00:00Z" }]` | `"PT4800000000H"` |
| two touching halves | `[{ "-271821-04-20T00:00:00Z", "1970-01-01T00:00:00Z" }, { "1970-01-01T00:00:00Z", "+275760-09-13T00:00:00Z" }]` | `"PT4800000000H"` |
| invalid | `[inverted]`, `"x"`, `[null]` | `""` |

**Agreement with Temporal.** For every single-interval row, assert that
`sumIntervals([i])` equals
`Temporal.Instant.from(i.start).until(Temporal.Instant.from(i.end), { largestUnit: "hour" }).toString()`.
Verified equal for every single-interval row here, including the full Instant range, where
`until` returns `PT4800000000H`. Multi-interval rows have no single `until` to compare with.

**Error path.** `vi.spyOn(Temporal.Duration, "from").mockImplementation(() => { throw new RangeError(); })`,
then `sumIntervals([A])` → `""`. There is no pre-built mock for `Duration.from`, and `spyOn` is
the sanctioned pattern.

**`formatHourDuration` unit rows** (internal):

| input | expected |
| --- | --- |
| `0n` | `"PT0S"` |
| `178200000000001n` | `"PT49H30M0.000000001S"` |
| `2n**53n + 1n` | `"PT2501H59M59.254740993S"` |
| `17280000000000000000000n` | `"PT4800000000H"` |
| `-1n` | `""` |

### 6.9 `splitIntervalAt` (verified; interval = `A` unless stated)

| case | boundaries | expected |
| --- | --- | --- |
| one | `[Z(12:00:00)]` | `[{Z(09:00:00),Z(12:00:00)}, {Z(12:00:00),Z(17:00:00)}]` |
| unsorted | `[Z(15:00:00), Z(11:00:00)]` | `[{Z(09:00:00),Z(11:00:00)}, {Z(11:00:00),Z(15:00:00)}, {Z(15:00:00),Z(17:00:00)}]` |
| duplicate, Z first | `[Z(12:00:00), NY12]` | `[{Z(09:00:00),Z(12:00:00)}, {Z(12:00:00),Z(17:00:00)}]` |
| duplicate, NY first | `[NY12, Z(12:00:00)]` | `[{ start: Z(09:00:00), end: NY12 }, { start: NY12, end: Z(17:00:00) }]` |
| at edges | `[Z(09:00:00), Z(17:00:00)]` | `[A]` |
| outside | `[Z(08:00:00), Z(18:00:00)]` | `[A]` |
| at start, different spelling | `[NY9]` | `[{ start: Z(09:00:00), end: Z(17:00:00) }]` |
| none | `[]` | `[A]` |
| 1 ns inside the start | `[Z(09:00:00.000000001)]` | `[{Z(09:00:00),Z(09:00:00.000000001)}, {Z(09:00:00.000000001),Z(17:00:00)}]` |
| mixed zones | `["2024-01-01T13:00:00+01:00[Europe/Berlin]", "2024-01-01T23:00:00+09:00[Asia/Tokyo]"]` | `[{ Z(09:00:00), "…13:00:00+01:00[Europe/Berlin]" }, { "…13:00:00+01:00[Europe/Berlin]", "…23:00:00+09:00[Asia/Tokyo]" }, { "…23:00:00+09:00[Asia/Tokyo]", Z(17:00:00) }]` — output order is by instant (12Z, 14Z), not input order |
| empty interval `{Z(12:00:00),Z(12:00:00)}` | `[Z(12:00:00)]` | `[{Z(12:00:00),Z(12:00:00)}]` |
| empty interval, none | `[]` | `[{Z(12:00:00),Z(12:00:00)}]` |
| invalid boundary outside | `["2016-12-31T23:59:60Z"]` | `[]` |
| non-string boundary | `[123]` | `[]` |
| zoneless boundary | `["2024-01-01T12:00:00"]` | `[]` |

**Invariant rows:** for the "unsorted" and "mixed zones" rows,
`sumIntervals(pieces) === sumIntervals([A])`, and each
`pieces[k].end === pieces[k + 1].start` (`===`).

### 6.10 Round-trip property (final slice)

For `i` over `[A, { Z(12:00:00), Z(12:00:00) }]`, and `r` over every subset (including `[]`) of:

```text
[{Z(08:00:00),Z(10:00:00)}, {Z(12:00:00),Z(13:00:00)}, {Z(12:30:00),Z(14:00:00)},
 {NY17,Z(18:00:00)}, {Z(15:00:00),Z(15:00:00)}]
```

That is 32 subsets × 2 values of `i`, in a deterministic loop. Let
`inter = mergeIntervals(r).map(x => intersectIntervals(i, x)).filter(x => x !== null)`. Assert:

1. **Exact:**
   `Σ spanNs(p.start, p.end)` over `subtractIntervals(i, r)`, plus the same sum over `inter`,
   `=== spanNs(i.start, i.end)`. This is bigint, and it also proves the two sets are disjoint.
2. **As durations:** `sumIntervals([...subtractIntervals(i, r), ...inter]) === sumIntervals([i])`.

The reference run printed `roundtrip true` for all 21 subtract rows in §6.7.

---

## 7. TDD slice order (exactly as the plan)

1. `Interval` type (`types/interval.ts` + the `types/index.ts` export).
   Red: a compile-level test importing `type Interval` from `../../types`.
2. `isValidInterval`. Introduces `internal/intervalNanoseconds.ts` `parseIntervalNanoseconds`
   and `parseIntervalNanosecondsList`, with internal tests.
3. `intervalsOverlap`.
4. `intervalContains`.
5. `intersectIntervals`, plus the overlap ⇔ intersect property.
6. `clampInterval`.
7. `mergeIntervals`. Introduces `coalesceIntervalNanoseconds`.
8. `subtractIntervals`.
9. `splitIntervalAt`.
10. `sumIntervals`. Introduces `internal/hourDurationString.ts`.
11. Round-trip property test (§6.10), in `packages/gmt/src/interval/calculate/intervalAlgebra.test.ts`.

Do the namespace wiring (§5) with slice 2, so every later slice imports through the barrels.

---

## 8. Legacy doc slice (D6) — JSDoc only, no behaviour change

**Rule for tdd-dev:** before editing any example, confirm its actual output is pinned by an
existing test. If it is not, add a pinning row first. Existing test expectations do not change.
Every example value below was produced by running the shipped function (vitest probe).
Where noted, the matching test row already pins it.

### 8.1 Verified defects and exact fixes

**`intervalsOverlap{Date,DateTime,Time,Utc,Unix,Zoned}`** (6 files)

- The bullet "Adjacent intervals (e.g. `aEnd === bStart`) do NOT overlap — returns `false`." is
  false. The code uses `aEnd >= bStart && bEnd >= aStart`, and touching returns `true`.
  Verified for all 6, and the existing "adjacent or touching" test rows pin `true`.
- Replace that bullet with:
  `- Touching intervals (\`aEnd\` equal to \`bStart\`) share that endpoint and DO overlap — returns \`true\`.`
- Example fixes:
  - `intervalsOverlapTime("09:00:00", "17:00:00", "17:00:00", "18:00:00")`: the comment says
    `// false (adjacent)` → change it to `// true (touching)`.
  - `intervalsOverlapUnix(0, 1000000, 1000000, 2000000)`: `// false (adjacent)` →
    `// true (touching)`.
  - `intervalsOverlapDateTime`, `intervalsOverlapUtc` and `intervalsOverlapZoned`: the
    `// false (adjacent)` examples have a one-second gap (`…23:59:59` → `…00:00:00`), so relabel
    them `// false (disjoint, one-second gap)`. Then add a touching example. Verified `true`:
    - `intervalsOverlapDateTime("2024-01-01T10:00:00", "2024-06-30T23:59:59", "2024-06-30T23:59:59", "2024-12-31T23:59:59") // true (touching)`
    - `intervalsOverlapUtc("2024-01-01T00:00:00Z", "2024-06-30T23:59:59Z", "2024-06-30T23:59:59Z", "2024-12-31T23:59:59Z") // true (touching)`
    - `intervalsOverlapZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-06-30T23:59:59+00:00[UTC]", "2024-06-30T23:59:59+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // true (touching)`
  - `intervalsOverlapDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31") // false (adjacent)`
    → relabel `// false (consecutive days, no shared day)`. Add
    `intervalsOverlapDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31") // true (touching)` (verified).

**`intervalDifference{Utc,DateTime,Time,Unix}`** (4 files; outputs verified, and each already
pinned by row 1 of its test file)

- `intervalDifferenceUtc` example 1 →
  `// [{ start: "2024-01-01T09:00:00Z", end: "2024-06-01T11:59:59.999999999Z" }, { start: "2024-07-01T13:00:00.000000001Z", end: "2024-12-31T17:00:00Z" }]`
- `intervalDifferenceDateTime` example 1 →
  `// [{ start: "2024-01-01T09:00:00", end: "2024-06-01T11:59:59.999999999" }, { start: "2024-07-01T13:00:00.000000001", end: "2024-12-31T17:00:00" }]`
- `intervalDifferenceTime`:
  - example 1 → `// [{ start: "09:00:00", end: "11:59:59.999999999" }, { start: "13:00:00.000000001", end: "17:00:00" }]`
  - example 3 → `// [{ start: "09:00:00", end: "11:59:59.999999999" }]`
- `intervalDifferenceUnix` example 1 → `// [{ start: 0, end: 1499999999 }, { start: 1600000001, end: 1700000000 }]`.
  It currently omits the right-hand piece.
- `intervalDifferenceDate` and `intervalDifferenceZoned` examples are already correct (verified).
  Leave them.

**`intervalXor{Utc,DateTime,Time}`** (3 files; verified, pinned by rows 1–2 of each test)

- `intervalXorUtc` examples 1 and 2 (both inputs give the same output) →
  `// [{ start: "2024-01-01T09:00:00Z", end: "2024-04-01T10:59:59.999999999Z" }, { start: "2024-06-30T12:00:00.000000001Z", end: "2024-12-31T17:00:00Z" }]`
- `intervalXorDateTime` examples 1 and 2 →
  `// [{ start: "2024-01-01T09:00:00", end: "2024-04-01T10:59:59.999999999" }, { start: "2024-06-30T12:00:00.000000001", end: "2024-12-31T17:00:00" }]`
- `intervalXorTime` examples 1 and 2 →
  `// [{ start: "09:00:00", end: "10:59:59.999999999" }, { start: "12:00:00.000000001", end: "17:00:00" }]`
- `intervalXorDate`, `intervalXorUnix` and `intervalXorZoned` are correct (verified).

**`intervalAbuts{Time,Utc,DateTime,Zoned}`** (4 files)

- The summary line "one's end equals the other's start with zero gap and zero overlap"
  contradicts the rule bullet (`aEnd + 1 nanosecond === bStart`). Verified:
  `intervalAbutsUtc(…, "2024-06-30T12:00:00Z", "2024-06-30T12:00:00Z", …)` → `false`. Replace the
  summary with:
  `Return true when two intervals are exactly adjacent — one's end is one nanosecond before the other's start, so they share no instant and leave no gap.`
  - `intervalAbutsDate` summary: "one day before".
  - `intervalAbutsUnix` summary: "one unit before". Check its wording; its examples are correct
    (verified).
- Example 2 is wrong in all four: it claims `// true`, but it returns `false`. Verified, and the
  test row 2 pins `false`. Fix the input so the example shows the reverse-order true case:
  - `intervalAbutsTime("12:00:00.000000001", "17:00:00", "09:00:00", "12:00:00") // true` (verified)
  - `intervalAbutsUtc("2024-06-30T12:00:00.000000001Z", "2024-12-31T17:00:00Z", "2024-01-01T09:00:00Z", "2024-06-30T12:00:00Z") // true` (verified)
  - `intervalAbutsDateTime("2024-06-30T12:00:00.000000001", "2024-12-31T17:00:00", "2024-01-01T09:00:00", "2024-06-30T12:00:00") // true` (verified)
  - `intervalAbutsZoned("2024-06-30T12:00:00.000000001+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]", "2024-01-01T09:00:00+00:00[UTC]", "2024-06-30T12:00:00+00:00[UTC]") // true` (verified)
- These new inputs are not pinned yet. **Add a test row for each before editing.**
- `intervalAbutsDate` example 2 is correct (verified `true`).

**`intervalSplitAt{Date,DateTime,Time,Utc,Unix,Zoned}`** (6 files; wording)

- Add after the first bullet:
  `- Consecutive sub-intervals share their boundary: each record's \`end\` is the next record's \`start\` (e.g. splitting at \`"2024-01-05"\` gives \`… end: "2024-01-05" }, { start: "2024-01-05" …\`). Under this namespace's closed \`[start, end]\` reading that boundary belongs to both pieces — the pieces cover the interval without gaps but do not partition it.`
  (Verified output for `intervalSplitAtDate("2024-01-01", "2024-01-10", ["2024-01-05"])`.)
- In `intervalSplitAtDate`, `intervalSplitAtDateTime` and `intervalSplitAtTime`, the bullet names
  `` `divideEqually` ``, which is not an export. Change it to `` `intervalDivideEqually{Date,DateTime,Time}` ``
  respectively.

**Not a doc fix. Hand to the finalizer for the phase-2 issue:**
`intervalAbutsTime("22:00:00", "23:59:59.999999999", "00:00:00", "01:00:00")` returns `true`
(verified): `23:59:59.999999999 + 1 ns` wraps to midnight. I could not reproduce a wrap in
`intervalXorTime` or `intervalDifferenceTime`. Their ±1 ns steps are guarded by comparisons that
make the wrap unreachable. For example, `intervalXorTime("22:00:00", "23:59:59.999999999", "23:00:00", "23:30:00")`
gives `[{ "22:00:00", "22:59:59.999999999" }, { "23:30:00.000000001", "23:59:59.999999999" }]`.
The finalizer should confirm the audit's reproduction before logging those two.

### 8.2 The "closed; see `interval/`" note — BLOCKED on an owner decision (see §9.1)

**Wording, for the families that really are closed.** It goes as the first bullet under the
summary line:

```text
 * - Closed interval `[start, end]`: both endpoints belong to the interval. See `interval/` for
 *   GMT's half-open `[start, end)` standard (`intervalsOverlap`, `intersectIntervals`, …).
```

These 65 files are closed by reading their code:

| Families | Files each | Total |
| --- | --- | --- |
| `intervalsOverlap*`, `intervalContains*`, `intervalEngulfs*`, `intervalIntersection*`, `intervalUnion*`, `mergeIntervals*`, `intervalDifference*`, `intervalXor*`, `intervalXorAll*`, `intervalAbuts*` | 6 | 60 |
| `intervalOverlappingDays*` (Date, DateTime, Unix, Utc, Zoned) | 5 | 5 |

**Not closed. Do not apply the note until the owner decides:**

| Family | What the code/JSDoc actually does | Files |
| --- | --- | --- |
| `intervalCount*` | JSDoc already says "half-open interval `[start, end)`", and the end boundary is excluded | 6 |
| `intervalSplitAt*`, `splitIntervalByUnit*`, `intervalDivideEqually*` | tile with shared endpoints (§8.1); convention-neutral in shape | 18 |
| `intervalLength*`, `intervalFromDuration*` | exact length and construction; no membership rule | 12 |
| `isValid{Date,DateTime,Time,Unix,Utc,Zoned,CalendarZoned}Interval` | `start ≤ end` only | 7 |

---

## 9. Contradictions and open questions for the owner

1. **D6 note vs code.** D6 says to add a note "saying it is closed" to **every** legacy interval
   function. The plan's own context says three conventions coexist, and the code confirms it:
   - `intervalCount*` (6) is documented and implemented as half-open `[start, end)`;
   - 18 tiling functions and 19 length/construction/validator functions have no closed membership
     rule.

   A literal "closed" note on those 43 files would introduce new wrong docs in a slice whose
   purpose is to fix wrong docs. §8.2 applies the note only to the 65 closed files. The owner
   needs to choose for the other 43:
   - (a) no note;
   - (b) a family-specific note ("half-open `[start, end)`, like `interval/`" for
     `intervalCount*`; "tiles with shared endpoints; see `interval/` for the half-open standard"
     for the rest);
   - (c) the literal closed note anyway.

   I have not chosen.
2. **Reused grammar gap, not caused by CORE-6.** `parseInstantNanoseconds` rejects
   `"…Z[u-ca=hebrew]"` but **accepts** `"2024-01-01T09:00:00Z[!u-ca=hebrew]"` (verified
   `1704099600000000000n`). `hasCalendarAnnotation` checks the literal `[u-ca=`, and the RFC 9557
   critical flag `!` slips past. `spanNs`, `toNanoseconds` and `isValidInstant` inherit the same
   gap today.
   - D3 says CORE-6 uses that grammar and rejects `[u-ca=]`, so CORE-6 will inherit the gap.
   - Recommendation: a separate `patch` fixing `hasCalendarAnnotation` (or `parseInstantNanoseconds`)
     to reject a critical-flagged annotation. **Do not special-case it inside `interval/`.**
   - Not blocking for CORE-6; the CORE-6 tests should not pin either behaviour for `[!u-ca=]`.
3. **`Temporal.Instant.from` ignores the bracketed zone when an offset is present.**
   `"…T10:00:00+01:00[America/New_York]"` is accepted and means 09:00Z (verified). This is TC39
   behaviour for `Instant`, and the grammar is shared by `span/` and `precision/`. §6.2 pins it.
   Not a contradiction; recorded so nobody "fixes" it inside `interval/`.
