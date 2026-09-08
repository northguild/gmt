# CORE-2 — Span durations: `spanMs` + `spanNs`

**Scope:** Add `spanMs` and `spanNs` to `@northguild/gmt` core.
Millisecond and nanosecond duration between two ISO strings. Universal primitive for profiling, observability, and any span measurement.

## Gap

GMT has `diffZoned` and `diffUnix` but they return temporal `Duration` objects. Observability and IoT consumers need raw numbers.

## Scope

- `packages/gmt/src/span/index.ts`:
  - `spanMs(start: string, end: string): number` — Millisecond duration between two ISO strings.
  - `spanNs(start: string, end: string): bigint` — Nanosecond duration between two ISO strings.
- Both throw `RangeError` on invalid input.
- Negative durations: allowed (start > end). Return negative number/bigint.

## What gmt provides (do not re-implement)

- Use `toNanoseconds` from CORE-1: `spanNs(a, b) = toNanoseconds(b) - toNanoseconds(a)`
- `spanMs` is the number version of the same calculation

## Verification

- Round-trip via `toNanoseconds` / `fromNanoseconds`: `spanNs(a, b)` equals `toNanoseconds(b) - toNanoseconds(a)`
- Zero duration: `spanMs(iso, iso)` returns `0`
- Negative: `spanMs(b, a)` returns negative of `spanMs(a, b)`
- Invalid input throws `RangeError`
- `pnpm run validate` stays green
