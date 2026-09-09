# CORE-1 — Core: Precision bridge — `toNanoseconds` + `fromNanoseconds`

**Scope:** Add `toNanoseconds` and `fromNanoseconds` to `@northguild/gmt` core.
These are the universal precision primitives — they serve all realms and all telemetry consumers.

## Gap

GMT's `convertZonedToUnix` returns `number` milliseconds — insufficient for high-precision systems. `Temporal.Instant.epochNanoseconds` returns `bigint` for full nanosecond precision. Two consequences the first draft missed: `bigint` has no JSON representation, and most storage engines cannot hold nanoseconds, so a naive round-trip silently loses data.

## Scope

- `packages/gmt/src/precision/convert/toNanoseconds.ts`:
  - `toNanoseconds(isoString: string): bigint` — ISO 8601 string to nanoseconds since the Unix epoch, via `Temporal.Instant.from(...).epochNanoseconds`.
- `packages/gmt/src/precision/convert/fromNanoseconds.ts`:
  - `fromNanoseconds(nanoseconds: bigint, timeZone?: string): string` — Nanoseconds back to an ISO string via `Temporal.Instant.fromEpochNanoseconds`. Zoned string when `timeZone` is given, UTC otherwise.
- `packages/gmt/src/precision/format/nanosecondsToJson.ts`:
  - `nanosecondsToJson(nanoseconds: bigint): string` — Decimal string form for transport. `JSON.stringify` throws on `bigint`; every consumer needs this and should not hand-roll it.
  - `nanosecondsFromJson(value: string): bigint` — Inverse. Rejects non-integer and out-of-range input.
- `packages/gmt/src/precision/calculate/truncateNanoseconds.ts`:
  - `truncateNanoseconds(nanoseconds: bigint, unit: 'ms' | 'us'): bigint` — Explicit truncation toward the storage precision the caller is about to write to. Floors toward negative infinity so pre-1970 values truncate consistently.
- All functions return sentinels (`""`, `0n`) on invalid input, matching gmt's existing convention. They do **not** throw.

## Precision guarantee

JavaScript `Number` holds integers safely only to `2^53 − 1` ≈ 9.0 × 10^15. Nanoseconds since the Unix epoch exceeded that in April 1970. `Date.now() * 1e6` is not a nanosecond timestamp — it is a millisecond timestamp with three zeroes appended. `bigint` is required.

## Design notes

- Truncation direction is stated, not implied. `truncateNanoseconds(-1500n, 'us')` is `-2000n`, not `-1000n`; rounding toward zero produces off-by-one errors either side of the epoch.
- PostgreSQL `timestamptz` stores microseconds. Writing nanoseconds and reading back breaks round-trip equality unless the caller truncates first. Document this on `fromNanoseconds`.
- Leap seconds are **not** handled here. UTC-to-nanoseconds is a plain instant conversion; leap-second-aware scales live in the Space realm (SPA-48). The first draft's claim that this story needs the IERS table was wrong.

## Corrections

The original CORE-1 stated both functions "throw `RangeError` on invalid input (bridge pattern)" and that `fromNanoseconds` "needs the IERS leap second table for UTC conversion".

- **Throwing is removed.** The tracker's own Definition of Done requires sentinel returns, never throws. A single story cannot opt out of the library-wide contract.
- **The IERS dependency is removed.** `Temporal.Instant` is already a UTC instant; no leap-second table is involved in converting one to nanoseconds. That coupling would have pulled the Space realm's hardest dependency into the epic's first story.

## What gmt provides (do not re-implement)

- `Temporal.Instant.from` / `Temporal.Instant.fromEpochNanoseconds` — parsing and construction
- `Temporal.Instant.toString()` — ISO 8601 serialisation
- `@js-temporal/polyfill` — already available via the root re-export

## Verification

- Round-trip: `fromNanoseconds(toNanoseconds(iso))` returns an equivalent ISO string
- `toNanoseconds('1970-01-01T00:00:00Z')` returns `0n`
- Pre-epoch: `toNanoseconds('1969-12-31T23:59:59Z')` returns `-1000000000n`
- Values beyond `Number.MAX_SAFE_INTEGER` nanoseconds round-trip without loss
- `truncateNanoseconds(-1500n, 'us')` returns `-2000n`
- `nanosecondsFromJson(nanosecondsToJson(n))` returns `n`
- Invalid input returns the documented sentinel, never throws
- `pnpm run validate` stays green
