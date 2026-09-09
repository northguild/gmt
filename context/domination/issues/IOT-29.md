# IOT-29 — IoT: Monotonic readings

**Scope:** Elapsed-time measurement that survives wall-clock adjustment.

## Gap

Measuring a duration by subtracting two wall-clock timestamps is wrong whenever the clock is adjusted mid-measurement — an NTP step, a manual correction, a DST-confused RTC — and those are common on devices. The fix is a monotonic clock, which counts elapsed time and never jumps.

The original spec's `monotonicNow(): string` returned an ISO 8601 timestamp from a monotonic source. That is a contradiction: a monotonic reading has no wall-clock meaning, and formatting it as an ISO timestamp invites exactly the misuse the function exists to prevent. Its own design note conceded it would use `Date.now()`, which is not monotonic at all.

## Scope

- `packages/gmt/src/iot/get/monotonicReading.ts`:
  - `monotonicReading(): { timeOrigin: string, elapsedNs: bigint }` — A reading pair. `timeOrigin` is the wall-clock instant the monotonic source was zeroed; `elapsedNs` is nanoseconds since then.
- `packages/gmt/src/iot/calculate/monotonicSpan.ts`:
  - `monotonicSpan(from: Reading, to: Reading): bigint | null` — Nanoseconds between two readings. Returns the sentinel when the readings have different `timeOrigin` values, because they are then incomparable.
- `packages/gmt/src/iot/convert/readingToInstant.ts`:
  - `readingToInstant(reading: Reading): string` — Converts a reading to a wall-clock instant. Explicitly lossy: the result is only as accurate as `timeOrigin`, and drifts if the wall clock has since been corrected.

## Design notes

- **The reading pair is the whole point.** Keeping `timeOrigin` and `elapsedNs` separate makes the two questions distinguishable: "how long did this take" is answered exactly by `elapsedNs`, and "when did it happen" is answered approximately by combining them. A single ISO string cannot express that distinction, so callers cannot know which guarantee they have.
- **Readings from different origins are incomparable.** A process restart, a worker thread or a different device resets the origin. Returning a sentinel rather than a plausible-looking difference is the correct failure.
- **`readingToInstant` is documented as lossy in its JSDoc**, not merely in prose here. It is the function most likely to be reached for and misused.
- Node exposes `performance.timeOrigin` and `performance.now()`; browsers expose the same. Neither is `Date`, so the library-wide no-`Date` rule holds. Where no monotonic source exists, the function must report that rather than silently substituting a wall clock.

## Corrections

`monotonicNow(): string` is removed. It promised monotonicity in its name, conceded a non-monotonic implementation in its design note, and returned a type that discards the property being promised. All three problems are resolved by returning the reading pair instead.

## What gmt provides (do not re-implement)

- `toNanoseconds` / `fromNanoseconds` from CORE-1 — instant conversion
- `spanNs` from CORE-2 — the wall-clock equivalent, for contrast in documentation

## Verification

- Two readings taken in sequence have non-decreasing `elapsedNs`
- `monotonicSpan` between readings with different `timeOrigin` returns the sentinel
- `monotonicSpan(r, r)` returns `0n`
- `readingToInstant` round-trips to within the documented tolerance of `timeOrigin`
- A simulated wall-clock step between two readings leaves `monotonicSpan` unaffected while the equivalent `spanNs` is wrong, asserted explicitly
- Platforms without a monotonic source report unavailability rather than falling back silently
- `pnpm run validate` stays green
