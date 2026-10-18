# Slice 5 — Zone transitions: bounded, remembered, clock read lazily

Read with [index.md](./index.md). Story scope part 5. Slices 7 and 8 rely on this slice: their
closed forms find a span's transitions first, and must not pay the search again on every call.
`pnpm compat:oracle` must exit 0 after it (it touches the D13 workaround).

## Today

- `nextTransitionAfter(timeZone, from, until?)` and `previousTransitionBefore(timeZone, from,
  since?)` (`internal/zonedTransitionSearch.ts`) sample the offset every 5 days
  (`TRANSITION_SEARCH_STEP_NANOSECONDS`) and bisect. They run while the D13 probe fails, which is
  always on `@js-temporal/polyfill` 0.5.1 (`zonedWallClockOperations.ts:432`, `:481`, gate
  `isTransitionSearchCompatNeeded`). One `offsetAt` read builds a `ZonedDateTime`, an `Intl` read.
- Every call reads the clock (`currentEpochNanoseconds`) to place the "no further change" horizon
  three 366-day years past the later of `from` and now. That follows js-temporal's
  `GetNamedTimeZoneNextTransition`, and removing D13 must change no answer.
- Nothing is remembered: two calls over the same span read every offset twice.
- `certainlyTouchesMoreBuckets` (`zoneBucketCap.ts:62`) calls `zonedNextTransition(current)` with
  no limit although it stops at `prefixEndNs`, so its last search runs to the horizon.

## Change 1 — pass the limit

In `certainlyTouchesMoreBuckets`, call `zonedNextTransition(current, prefixEndNs - 1n)`. `until`
is inclusive and the loop stops at `next.epochNanoseconds < prefixEndNs`, so a change at
`prefixEndNs` or later was never used; with the limit it is never searched for. Same answer.

## Change 2 — read the clock only when it can matter

The horizon is at least `from + HORIZON`. When `until !== undefined && until <= from + HORIZON`,
the horizon cannot bind and the clock is not read. Otherwise read it as today. Same answer.

## Change 3 — a per-zone memo of facts

In `zonedTransitionSearch.ts`, a module-level `Map<string, ZoneFacts>`; nothing at import time.

```ts
/** What a search has proved about one zone: spans with every change in them known. */
type ZoneFacts = { spans: KnownSpan[] };           // sorted, disjoint, never touching
type KnownSpan = { low: bigint; high: bigint; changes: bigint[] };
// Proven: within (low, high] the zone changes offset exactly at `changes` (sorted), and nowhere else.
```

**What is stored.** Only what a search observed, independent of the clock:

- A forward search from `from` that finds change `T`: no change in `(from, T)`, a change at `T`.
  Record `(from, T]` with `changes = [T]`.
- A forward search that stops at its `end` with none: record `(from, end]` with no changes. This
  is a fact about `(from, end]` whether `end` came from `until` or from the horizon. The answer
  `null` is **not** stored: past `end` nothing was proved.
- Backward searches likewise: `[T, from)` with `changes = [T]`, or `(since, from)` with none.
- Merge a new span with any span it overlaps or touches; keep `changes` sorted and unique.

**What is answered from it.** `nextTransitionAfter(zone, from, until)`:

1. Compute `end` as today (with change 2).
2. If a span holds `from` (`low <= from < high`): the first change in it after `from`, if any,
   is the answer when it is `<= end`, else `null`. If it has none after `from` and
   `high >= end`, answer `null`. Otherwise continue the search **from `high`** rather than from
   `from`: the stretch `(from, high]` is already proved empty.
3. Search the rest as today, record what it proves, answer.

`previousTransitionBefore` mirrors it. The before-1847 paths (`missedNextTransition`,
`missedPreviousTransition`) and `previousTransitionFarAhead` are answered exactly as today; only
plain sampled stretches feed or read the memo. That keeps the polyfill-horizon rule untouched.

**Soundness** (index authority row, GMT rule): an offset is a pure function of zone and instant
for the life of the process; the polyfill reads it from the host's `Intl` time zone data, loaded
once. The memo stores observations of that function, never conclusions about the clock.

**Bounds** (GMT rule): at most 64 zones; at most 4,096 changes and 256 spans per zone. When a
record would pass a bound, clear that zone's facts and store only the new span. A long-running
process cannot grow it without limit, and clearing loses speed, never correctness.

**Test seam:** export `clearTransitionMemo()` from `zonedTransitionSearch.ts` (internal, not
public), used only by tests.

## The D13 retirement note

`temporalCompat/README.md` and `scripts/temporal-compat.mjs`'s D13 hint list what to delete when
D13 is fixed upstream. Add the memo: it lives in `zonedTransitionSearch.ts` and goes with it.
The native `getTimeZoneTransition` path gets no memo: on an engine that answers correctly it is
fast, and the seam (slice 2) leaves that choice to a later story.

## Tests

`zonedTransitionSearch.test.ts` and every zoned test stay green unchanged. Add, in that file,
with expected transition instants from `zdump -v` (tz 2026c), as the file's existing rows are:

| Row | Expectation |
| --- | ----------- |
| `Europe/London` 2024, next after 2024-01-01 twice in a row | Same instant both times (2024-03-31T01:00:00Z); the second call reads no offset (spy on the offset reader through the test seam) |
| next after 2024-01-01 `until` 2024-02-01, then next after 2024-01-01 with no limit | `null`, then 2024-03-31T01:00:00Z: a stored empty span never turns into a stored `null` |
| next after 2024-02-01 after a memo holding `(2024-01-01, 2024-03-31T01:00Z]` | 2024-03-31T01:00:00Z, answered from the span |
| previous before 2024-06-01 after a forward search stored that span | 2024-03-31T01:00:00Z |
| `America/Boa_Vista` 2000-10-01 forward three times | 2000-10-08 then 2000-10-15 (the pair 601,200 s apart), memo and no memo agree |
| `Asia/Kolkata` from 1900-01-01 with no limit, the clock set to two different "now"s (`vi.setSystemTime`, if the polyfill's `Now` follows it; otherwise route `currentEpochNanoseconds` through the test seam) | The answer follows each horizon; the empty span proved under the first is reused, the `null` is not |
| 65 zones searched once each | The first zone's facts are evicted; its next answer is still correct |
| `clearTransitionMemo()` between every row of the existing table (a `beforeEach`) and without it | Both pass: no row depends on memo state |

`certainlyTouchesMoreBuckets`: existing `zoneBucketCap` rows unchanged; add one where a change
lies exactly at `prefixEndNs` (`Europe/London`, a prefix ending on 2024-03-31T01:00:00Z) and
assert the same boolean as before.

## Bench

`bucketRange.bench.ts` rows from slice 1. Baselines (Node 24.21.0, a 40-year span refused by the
pre-check): `Asia/Kolkata` from 1900 34.8 ms, `Europe/London` from 1900 16.4 ms, from 2400
17.0 ms. Record cold (first call) and warm.

## Done when

- The clock is read only when the horizon can bind; `certainlyTouchesMoreBuckets` passes its limit.
- The memo answers repeat searches with no offset reads, and every existing row passes with it
  cleared before each row and with it warm.
- `pnpm compat:oracle` exits 0; `pnpm run validate` green.
