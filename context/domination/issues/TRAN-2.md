# TRAN-2 — Transport: Multi-leg scheduling — `scheduleDelivery` + `crossingTime`

**Scope:** Multi-modal transport scheduling with zone-local times. Replaces LOG-2.

## Gap

Multi-modal transport (truck → ship → plane → rail) involves multiple legs, each with its own departure time, duration, and destination zone.

## Scope

- `packages/gmt/src/transport/scheduling.ts`:
  - `crossingTime(entry: string, exit: string, targetZone: string): { duration: string, enter: string, exit: string }` — Given entry and exit UTC times for a zone crossing, returns duration spent and zone-local entry/exit times.
  - `scheduleDelivery(legs: { departure: string, duration: string, timezone: string, mode?: string }[], options?: { startTimezone?: string }): { eta: string, legTimes: string[] }` — Computes end-to-end ETA across multiple legs.

## Design notes

- `departure` times are interpreted in the timezone of the previous leg's destination (or `startTimezone` for the first leg).
- Each leg's arrival = next leg's departure.
- `mode` is a string tag for consumer use. GMT does not validate modes.
- Invalid leg returns `""` for that leg's arrival and overall ETA.

## What gmt provides (do not re-implement)

- `transitTime` from TRAN-1 — base case
- `convertUtcToZoned` / `convertZonedToZoned` — timezone conversion

## Verification

- Single-leg `scheduleDelivery` matches `transitTime` + `etaAtZone`
- Multi-leg: each leg's arrival = next leg's departure
- Final ETA is in the last leg's timezone
- Empty legs array: `{ eta: '', legTimes: [] }`
- `pnpm run validate` stays green
