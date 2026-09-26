# TRAN-9 — Transport: Multi-leg scheduling — `scheduleDelivery` + `crossingTime`

**Scope:** Multi-modal journey scheduling with zone-local times at every handoff.

## Gap

A multi-modal move (truck → ship → rail) has a departure, a duration and a destination zone per leg, plus dwell between legs. Computing an end-to-end ETA means carrying the zone forward correctly at each handoff, which is where naive implementations lose an hour.

## Scope

- `packages/gmt/src/transport/calculate/crossingTime.ts`:
  - `crossingTime(entry: string, exit: string, targetZone: string): { duration: string, enter: string, exit: string } | null` — Zone-local entry and exit for a crossing.
- `packages/gmt/src/transport/calculate/scheduleDelivery.ts`:
  - `scheduleDelivery(legs: Leg[], options?: { startTimeZone?: string }): { eta: string, legTimes: LegTime[] } | null` — End-to-end ETA across legs.
- `Leg` is `{ departure?: string, duration: string, timeZone: string, dwellAfter?: string, mode?: string, origin?: string, destination?: string }`.
- `LegTime` is `{ arrival: string, localArrival: string, dwellAfter: string, mode?: string, origin?: string, destination?: string }` — the leg's tags echoed back so a caller can join results to its own records.

## Design notes

- Each leg's arrival is the next leg's departure unless the next leg carries an explicit `departure`, which models a scheduled connection the cargo waits for. An explicit departure earlier than the previous arrival is invalid input, not a negative wait — that is a missed connection and the caller must be told.
- **Missed-connection rule (decided):** `dwellAfter` is the minimum connect time. A connection is feasible when the scheduled departure is at or after the previous arrival plus the previous leg's `dwellAfter`; earlier — inside the dwell or before the arrival — is a missed connection and returns `null`. Equal passes: a zero-slack connection is feasible.
- **Departure exactness and `startTimeZone` (decided):** every leg boundary is an exact instant. A departure is accepted when it is already exact — an instant (`Z`/offset) or a zoned string, whose bracketed zone is read and must be real and agree with its offset. The one exception is the first leg: schedules are published as zone-local wall times, so a zoneless first-leg departure is read in `options.startTimeZone` (an IANA timeZone identifier or a fixed offset). Zoneless without the option, or on any later leg, returns `null`; the option is ignored when the departure is already exact; an invalid `startTimeZone` returns `null` even when unused.
- **Local-time resolution policy (decided, `compatible`):** a zoned departure written without an offset (`2024-11-03T01:30:00[America/New_York]`) and a zoneless first departure read in `startTimeZone` are wall times. An ambiguous wall time resolves to the earlier instant; a nonexistent wall time resolves to the later instant.
- **A negative leg is invalid input (decided):** a leg cannot arrive before it departs, so a negative `duration` returns `null`, although `transitTime` alone accepts one. A zero duration, including `-PT0S`, passes.
- **The last leg's `dwellAfter` moves nothing (decided):** it is validated as a duration (no years, months or weeks; not negative) and echoed, but never added to an instant, so it cannot turn a representable ETA into `null`.
- `dwellAfter` sits between legs rather than inside them, because dwell is a property of the handoff.
- `mode`, `origin` and `destination` are opaque tags. GMT does not validate or interpret transport modes, and it does not resolve an origin or destination code to a zone — `timeZone` is the caller's fact. The tags exist so a container move (ship → rail → truck) can be reported leg by leg without the consumer re-joining by index.
- Every leg boundary is an instant. Local rendering happens at the edges via `etaAtZone`.

## What gmt provides (do not re-implement)

- `transitTime` / `etaAtZone` from TRAN-8 — the single-leg case
- `mergeIntervals` / `sumIntervals` from CORE-6 — total dwell
- `convertZonedToZoned` — timezone conversion

## Verification

- Single-leg `scheduleDelivery` matches `transitTime` composed with `etaAtZone`
- Multi-leg: each leg's arrival equals the next leg's departure when no explicit departure is given
- A leg crossing the International Date Line yields a local arrival on the expected local date
- A leg arriving at 23:30 local returns a `localArrival` on the expected local date
- Explicit departure earlier than the previous arrival returns the sentinel
- Empty legs array returns `{ eta: '', legTimes: [] }`
- Total dwell equals the sum of `dwellAfter` values
- `mode`, `origin` and `destination` are echoed unchanged on each `LegTime`, and absent when not supplied
- `pnpm run validate` stays green
