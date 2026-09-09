# TRAN-8 — Transport: Transit time + ETA + dwell time

**Scope:** Core transport utilities shared across all transport modes.

## Gap

All transport modes share three basic operations: adding a duration to a departure to get an arrival, converting that arrival to zone-local time for display, and measuring how long something sat somewhere.

## Scope

- `packages/gmt/src/transport/calculate/transitTime.ts`:
  - `transitTime(departure: string, duration: string): string` — Adds an ISO duration to a departure. The departure's timezone is preserved.
- `packages/gmt/src/transport/convert/etaAtZone.ts`:
  - `etaAtZone(arrivalUtc: string, targetZone: string): string` — UTC arrival to local time in the target zone for display.
- `packages/gmt/src/transport/calculate/dwellTime.ts`:
  - `dwellTime(entry: string, exit: string, targetZone?: string): { duration: string, enter: string, exit: string, calendarDays: number } | null` — Time spent, with zone-local entry and exit. `calendarDays` counts local date boundaries crossed, which is the basis every dwell-charging regime uses.

## Design notes

- `targetZone` is an IANA zone identifier supplied by the caller. GMT does not resolve a port, airport or station code to a zone — see the parked registries note in [../painpoints.md](../painpoints.md).
- `calendarDays` is not `duration` rounded. A container entering at 23:00 and leaving at 01:00 spans two local calendar days over two hours. Charging regimes count boundaries, not elapsed time, which is why this is returned rather than left to the caller.
- `transitTime` preserves the departure zone. Multi-leg journeys that change zone use `scheduleDelivery` (TRAN-9).

## What gmt provides (do not re-implement)

- `addDuration` / `subtractDuration` — duration arithmetic
- `convertUtcToZoned` / `convertZonedToZoned` — timezone conversion
- `floorToZone` from CORE-5 — local date boundaries, for `calendarDays`
- `spanMs` from CORE-2 — elapsed time

## Verification

- `transitTime('2024-06-15T10:00:00-05:00[America/New_York]', 'PT2H30M')` returns `'2024-06-15T12:30:00-05:00[America/New_York]'`
- `etaAtZone('2024-06-15T12:30:00Z', 'Asia/Tokyo')` returns `'2024-06-15T21:30:00+09:00[Asia/Tokyo]'`
- `transitTime` across a DST transition adds exact elapsed time, and the local wall time reflects the shift
- `dwellTime` from 23:00 to 01:00 local returns `calendarDays: 2` with a two-hour duration
- Invalid duration or timezone returns the sentinel
- Full IANA timezone coverage
- `pnpm run validate` stays green
