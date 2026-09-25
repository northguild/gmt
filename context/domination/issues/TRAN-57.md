# TRAN-57 — Transport: Schedule deviation, punctuality and timestamp classification

**Scope:** Planned versus actual: the signed deviation, its classification against a tolerance, the vocabulary that says whether a timestamp is planned, estimated, requested or actual, and the next feasible departure from a timetable.

## Gap

Every mode publishes a plan and records what happened, and every mode measures the gap the same way — yet each realm here was about to define "late" for itself. One mode counts an arrival on time under a 15-minute tolerance; another keys compensation on 60- and 120-minute thresholds; an ocean carrier's schedule reliability is measured in days. The arithmetic is identical; only the tolerance differs, and the tolerance is the caller's fact.

The second shared problem is that one field means four things. DCSA's Just-in-Time Port Call API defines `eventClassifierCode` with the enum `PLN`, `EST`, `REQ`, `ACT` — "Code for the event classifier can be ACT (Actual) PLN (Planned) EST (Estimated) REQ (Requested)" — and its Track & Trace event domain allows `ACT`/`PLN`/`EST` on shipment, transport and equipment events and adds `REQ` only for operations events, running the estimated → requested → planned → actual cycle (ETA, RTA, PTA, ATA) for every nautical service. Comparing an estimate to an actual as though both were observations is the standard visibility-dashboard bug, and nothing in the library names the classes.

([DCSA JIT Port Call OpenAPI 1.2.0-Beta-2, `eventClassifierCode`](https://raw.githubusercontent.com/dcsaorg/DCSA-OpenAPI/master/jit/v1/jit_v1.2.0-Beta-2.yaml), [DCSA `EVENT_DOMAIN` 1.0.4 (Track & Trace 2.2)](https://api.swaggerhub.com/domains/dcsaorg/EVENT_DOMAIN/1.0.4))

## Scope

- `packages/gmt/src/transport/compare/scheduleDeviation.ts`:
  - `scheduleDeviation(planned: string, actual: string): string` — Signed ISO duration; positive is late.
  - `classifyPunctuality(planned: string, actual: string, tolerance: { late: string, early?: string }): 'early' | 'onTime' | 'late'` — Half-open at the late boundary: exactly `late` is late, so "on time" means strictly inside the tolerance.
  - `punctualityRate(pairs: { planned: string, actual: string }[], tolerance): { onTime: number, total: number, rate: number } | null` — The share on time; the sentinel for an empty list.
- `packages/gmt/src/transport/get/timestampClass.ts`:
  - `TimestampClass` is `'PLN' | 'EST' | 'REQ' | 'ACT'`, the DCSA vocabulary.
  - `bestAvailable(events: { classifier: TimestampClass, at: string, recordedAt: string }[]): { at: string, classifier: TimestampClass } | null` — `ACT` if present; otherwise the most recently recorded `PLN`, else `REQ`, else `EST`. The precedence is the port-call cycle's own order and is documented, not configurable.
  - `estimateDrift(events, options?: { tolerance?: string }): { first: string, last: string, drift: string, revisions: number, exceedsTolerance: boolean | null } | null` — How far the estimate moved between first and last `EST`, for schedule-reliability reporting. With `tolerance`, `exceedsTolerance` says whether the absolute drift is greater than it — the question "has the estimate moved far enough that something must be redone"; without `tolerance` it is `null`.
- `packages/gmt/src/transport/calculate/nextDeparture.ts`:
  - `nextDeparture(after: string, timetable: string[] | { headway: string, from: string, to: string }, options?: { minimumConnection?: string }): string` — The first scheduled departure at or after `after` plus the minimum connection; `''` when none. Headway form covers GTFS `frequencies.txt`, ferries and shuttle services.

## Design notes

- **Tolerances are parameters; none is a default.** The docs show a 15-minute tolerance, a 60/120-minute pair and a day-based one, labelled by their numbers, so a caller can pick knowingly; "on time" without a stated tolerance is not a measurement, and the half-open late boundary is this library's stated convention, not a reading of any rule.
- **`scheduleDeviation` is a span of instants.** A schedule's local time is rendered by `etaAtZone`; the deviation itself is exact elapsed time, so a delay across a DST transition is 60 minutes, not 0 or 120.
- **`bestAvailable` never mixes classes.** It returns the class with the value so the consumer can label it; a dashboard that shows an `EST` in the `ACT` column is the failure this prevents.
- **`nextDeparture` is timetable lookup, not routing.** It answers "which departure can this connection make", the input `scheduleDelivery` (TRAN-9) needs for an explicit `departure`; choosing among routes remains the consumer's problem.
- OTP aggregation is included because the definition is small and the tolerance is the caller's; anything beyond a rate — percentiles, causal attribution — is the consumer's.

## Corrections

- The drift-against-a-tolerance test came from the advance-filing story, where it was a function that decided whether a revised estimate required a new filing under one regime's threshold. It is `estimateDrift` with the caller's `tolerance` and an `exceedsTolerance` flag; the threshold is the caller's and the consequence is the consumer's.

## What gmt provides (do not re-implement)

- `transitTime` / `etaAtZone` from TRAN-8 — the planned-arrival side
- `spanMs` from CORE-2 — the deviation
- `intervalContains` from CORE-6 — tolerance windows
- `addDuration` — minimum-connection arithmetic

## Verification

- `scheduleDeviation` returns `PT14M` for a 14-minute late arrival and `-PT5M` for an early one
- `classifyPunctuality` with `late: 'PT15M'` returns `'onTime'` at 14 minutes 59 seconds and `'late'` at exactly 15 minutes — the half-open boundary, asserted
- Without `early`, any early arrival is `'onTime'`; with `early: 'PT10M'`, 11 minutes early is `'early'`
- A delay across a fall-back transition is measured as exact elapsed time
- `punctualityRate` over four pairs with one late returns `rate: 0.75`; an empty list returns the sentinel
- `bestAvailable` returns the `ACT` when present regardless of recording order, the newest `PLN` otherwise, and never an `EST` when a `REQ` exists
- `estimateDrift` over three `EST` revisions reports `revisions: 3` and the first-to-last difference; without `tolerance`, `exceedsTolerance` is `null`
- `estimateDrift` with `tolerance: 'PT8H'` reports `exceedsTolerance: true` for a nine-hour move and `false` for a seven-hour one, in either direction
- `nextDeparture` with a list skips departures before `after + minimumConnection`; with a 20-minute headway from 06:00 it returns the first multiple of 20 minutes at or after the input, and `''` after `to`
- `pnpm run validate` stays green
