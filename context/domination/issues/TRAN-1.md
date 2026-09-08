# TRAN-1 — Transport: Transit time + ETA + dwell time

**Scope:** Core transport utilities shared across all transport modes. Replaces LOG-1.

## Gap

All transport modes share three basic operations: adding a duration to a departure to get arrival, converting that arrival to zone-local time for display, and measuring how long something sat in a zone.

## Scope

- `packages/gmt/src/transport/transit.ts`:
  - `transitTime(departure: string, duration: string): string` — Adds a duration to a departure time to get arrival time. Departure timezone is preserved.
  - `etaAtZone(arrivalUtc: string, targetZone: string): string` — Converts a UTC arrival time to the local time in the target zone for display.
  - `dwellTime(entry: string, exit: string, targetZone?: string): { duration: string, enter: string, exit: string }` — Given entry and exit times, returns duration spent and zone-local entry/exit times. If `targetZone` is provided, entry/exit are converted to that zone.

## Design notes

- `transitTime` preserves the departure's timezone. For multi-mode journeys crossing timezones, use `scheduleDelivery` (TRAN-2).
- `duration` must be a valid ISO 8601 duration string (`"PT2H30M"`).
- Invalid duration or timezone returns `""` sentinel.

## What gmt provides (do not re-implement)

- `addDuration` / `subtractDuration` — existing gmt duration arithmetic
- `convertUtcToZoned` / `convertZonedToZoned` — timezone conversion

## Verification

- `transitTime('2024-06-15T10:00:00-05:00[America/New_York]', 'PT2H30M')` → `'2024-06-15T12:30:00-05:00[America/New_York]'`
- `etaAtZone('2024-06-15T12:30:00Z', 'Asia/Tokyo')` → `'2024-06-15T21:30:00+09:00[Asia/Tokyo]'`
- `dwellTime` returns correct zone-local times
- Invalid duration / timezone returns `""`
- `pnpm run validate` stays green
