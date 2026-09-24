# IOT-30 — IoT: Clock offset and drift estimation

**Scope:** Estimating a device clock's offset and drift from timestamp exchanges, and bounding the uncertainty of the result.

## Gap

The original `deviceSync(deviceTime, serverTime) => { drift, offset }` is not solvable as specified. Two timestamps give one equation; offset and drift are two unknowns. Its own design note admitted it "assumes a single measurement" and that "multiple measurements over time improve accuracy" — but with one measurement, drift is not merely imprecise, it is undetermined. Any value returned would be fabricated.

The correct model is the NTP exchange, which uses **four** timestamps to separate offset from network delay, and two or more offset samples separated in time to estimate drift. The same exchange also bounds the error. RFC 5905 defines the synchronization distance λ = ε + δ/2 — root dispersion plus half the root delay — as "the maximum error due to all causes", and its selection algorithm places every candidate's correctness interval at `[θ − λ, θ + λ]`. With no dispersion term the half-width collapses to δ/2, which is a lower bound on the true half-width, never the bound itself.

([RFC 5905 §8 on-wire protocol; §4 and §11.2 synchronization distance; §11.2.1 selection algorithm](https://www.rfc-editor.org/rfc/rfc5905))

## Scope

- `packages/gmt/src/iot/calculate/clockOffset.ts`:
  - `clockOffset(exchange: { t1: string, t2: string, t3: string, t4: string }): { offsetMs: number, delayMs: number } | null` — One NTP-style exchange. `t1` client send, `t2` server receive, `t3` server send, `t4` client receive.
  - `uncertaintyInterval(offsetMs: number, delayMs: number, at: string, options?: { dispersionMs?: number }): Interval` — The instants the true time could be, `[at + θ − λ, at + θ + λ]` with `λ = dispersion + delay/2` (RFC 5905 §11.2.1). `dispersionMs` defaults to `0`, and the JSDoc states that the result is then the delay-only lower bound on the interval, not the full root distance.
- `packages/gmt/src/iot/calculate/clockDrift.ts`:
  - `clockDrift(samples: { at: string, offsetMs: number }[]): { driftPpm: number, intercept: number, samples: number } | null` — Least-squares drift in parts per million across at least two samples. Fewer than two returns the sentinel.
  - `projectClock(driftPpm: number, intercept: number, from: string, at: string): number` — Projected offset at a future instant.
- `packages/gmt/src/iot/compare/detectClockStep.ts`:
  - `detectClockStep(samples, options: { thresholdMs: number }): { at: string, magnitudeMs: number }[]` — Discontinuities, which must be excluded from drift estimation.

## The NTP formulas

```text
theta  = ((t2 - t1) + (t3 - t4)) / 2          RFC 5905 §8
delta  = (t4 - t1) - (t3 - t2)                RFC 5905 §8
lambda = epsilon + delta / 2                  RFC 5905 §4, §11.2  (epsilon = dispersion)
true offset ∈ [theta - lambda, theta + lambda] RFC 5905 §11.2.1
```

Offset assumes the network path is symmetric. Delay quantifies the round trip, and a large delay means low confidence in the offset — which is why both are returned together and neither is useful alone. The interval bound needs no symmetry assumption, but it does need the dispersion term to be the RFC's bound rather than an optimistic one.

## Design notes

- **Drift requires at least two samples**, and honest failure below that is the entire point of this rewrite. Returning a drift from one measurement is fabrication.
- **A clock step is not drift.** A resync jump appears in the samples as a large instantaneous offset change; including it in a least-squares fit corrupts the drift estimate badly. `detectClockStep` exists so callers can segment their samples, and the drift function documents that stepped samples must be split.
- **`uncertaintyInterval` turns an estimate into a range a consumer can act on.** Ordering two events from different devices is safe only when their intervals do not overlap; IOT-66 builds its ordering rules on this shape. Returning the interval rather than a bare offset makes the ambiguity visible.
- Drift is reported in ppm, which is the conventional unit and stays meaningful across sample intervals. One ppm is about 86 ms per day.
- These are estimates over noisy data. Every function reports the inputs it used so callers can judge confidence, rather than returning a bare number that looks authoritative.

## Corrections

`deviceSync(deviceTime, serverTime)` is removed as underdetermined. `deviceTimeAt(serverTime, drift, offset)` is replaced by `projectClock`, which takes the fitted intercept and a reference instant — the original signature had no reference point, so linear extrapolation from it was undefined.

## What gmt provides (do not re-implement)

- `spanMs` / `spanNs` from CORE-2 — timestamp differences
- `toNanoseconds` from CORE-1 — precision where sub-millisecond offsets matter
- `monotonicSpan` from IOT-29 — for callers measuring the round trip locally
- `Interval` from `types/` — the uncertainty shape

## Verification

- `clockOffset` with a symmetric exchange and known offset recovers that offset exactly
- `clockOffset` with asymmetric delay returns the documented, biased result, asserted rather than hidden — and the true offset still lies inside `uncertaintyInterval`, asserted
- `delayMs` is non-negative for a well-formed exchange; a malformed one returns the sentinel
- `uncertaintyInterval` has width exactly `delayMs` with no dispersion, and `delayMs + 2 × dispersionMs` with it
- `clockDrift` with one sample returns the sentinel
- `clockDrift` over samples on a known linear ramp recovers the drift to within tolerance
- `detectClockStep` finds an injected step and no others
- Drift fitted across an undetected step is demonstrably wrong, asserted to document why segmentation matters
- `pnpm run validate` stays green
