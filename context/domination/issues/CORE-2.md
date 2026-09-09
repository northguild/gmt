# CORE-2 — Core: Span durations — `spanMs` + `spanNs`

**Scope:** Millisecond and nanosecond duration between two ISO strings. Universal primitive for profiling, observability, and any span measurement.

## Gap

GMT has `diffZoned` and `diffUnix`, which return Temporal `Duration` objects. Observability and IoT consumers need raw numbers. Three traps the first draft did not address: sign convention, wall-clock versus exact time across a DST transition, and leap seconds.

## Scope

- `packages/gmt/src/span/calculate/spanMs.ts`:
  - `spanMs(start: string, end: string): number` — Millisecond duration between two ISO strings. Negative when `start` is after `end`.
- `packages/gmt/src/span/calculate/spanNs.ts`:
  - `spanNs(start: string, end: string): bigint` — Nanosecond duration. Negative when `start` is after `end`.
- `packages/gmt/src/span/calculate/spanWallClock.ts`:
  - `spanWallClock(start: string, end: string, unit: 'days' | 'hours'): number | null` — Calendar-aware span in the zone carried by the inputs. Distinct from `spanMs`, which is always exact elapsed time.
- Sentinels on invalid input: `0` / `0n` are valid results, so invalid input returns `NaN` / `null` respectively and is documented as such.

## Design notes

- **Exact versus wall clock.** Across a DST transition, "one day later" and "24 hours later" differ by an hour. `spanMs` measures elapsed time; `spanWallClock` measures calendar distance. Both are correct answers to different questions, and conflating them is the most common span bug.
- **Leap seconds.** A span computed from two UTC strings across a leap second is one second short of the physical elapsed time, because UTC repeats a second. Against a smeared clock (Google, AWS, Meta) the error is up to a second, spread across the smear window. Document the limitation; leap-second-exact spans are SPA-48's job.
- **Overflow.** `spanMs` over very large ranges exceeds `Number.MAX_SAFE_INTEGER`. Document the safe range and direct callers past it to `spanNs`.

## What gmt provides (do not re-implement)

- `toNanoseconds` from CORE-1 — `spanNs(a, b)` is `toNanoseconds(b) - toNanoseconds(a)`
- `diffZoned` — the existing `Duration`-returning form, for callers who want calendar units

## Verification

- `spanNs(a, b)` equals `toNanoseconds(b) - toNanoseconds(a)`
- Zero: `spanMs(iso, iso)` returns `0`
- Sign: `spanMs(b, a)` equals `-spanMs(a, b)`
- Across US spring-forward, `spanWallClock(...,'hours')` and `spanMs` disagree by exactly one hour, and both are asserted
- Range exceeding `Number.MAX_SAFE_INTEGER` ms returns `NaN` from `spanMs` and an exact value from `spanNs`
- Invalid input returns `NaN` / `null`
- `pnpm run validate` stays green
