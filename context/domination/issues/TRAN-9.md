# TRAN-9 — Transport: Multi-leg scheduling — `scheduleDelivery` + `crossingTime`

**Scope:** Multi-modal journey scheduling with zone-local times at every handoff.

## Gap

A multi-modal move (truck → ship → rail) has a departure, a duration and a destination zone per leg, plus dwell between legs. Computing an end-to-end ETA means carrying the zone forward correctly at each handoff, which is where naive implementations lose an hour.

## Scope

- `packages/gmt/src/transport/calculate/crossingTime.ts`:
  - `crossingTime(entry: string, exit: string, targetZone: string): { duration: string, enter: string, exit: string } | null` — Zone-local entry and exit for a crossing.
- `packages/gmt/src/transport/calculate/scheduleDelivery.ts`:
  - `scheduleDelivery(legs: Leg[], options?: { startTimeZone?: string }): { eta: string, legTimes: { arrival: string, localArrival: string, dwellAfter: string }[] } | null` — End-to-end ETA across legs.
- `Leg` is `{ departure?: string, duration: string, timeZone: string, dwellAfter?: string, mode?: string }`.

## Design notes

- Each leg's arrival is the next leg's departure unless the next leg carries an explicit `departure`, which models a scheduled connection the cargo waits for. An explicit departure earlier than the previous arrival is invalid input, not a negative wait — that is a missed connection and the caller must be told.
- `dwellAfter` sits between legs rather than inside them, because dwell is a property of the handoff.
- `mode` is an opaque tag. GMT does not validate or interpret transport modes.
- Every leg boundary is an instant. Local rendering happens at the edges via `etaAtZone`.

## What gmt provides (do not re-implement)

- `transitTime` / `etaAtZone` from TRAN-8 — the single-leg case
- `mergeIntervals` / `sumIntervals` from CORE-6 — total dwell
- `convertZonedToZoned` — timezone conversion

## Verification

- Single-leg `scheduleDelivery` matches `transitTime` composed with `etaAtZone`
- Multi-leg: each leg's arrival equals the next leg's departure when no explicit departure is given
- A leg crossing the International Date Line yields a local arrival on the expected local date
- Explicit departure earlier than the previous arrival returns the sentinel
- Empty legs array returns `{ eta: '', legTimes: [] }`
- Total dwell equals the sum of `dwellAfter` values
- `pnpm run validate` stays green
