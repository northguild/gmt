# AV-1 — Aviation: Flight schedules — `flightLeg` + `crewDutyWindow` + `airportCurfew`

**Scope:** Flight leg timezone crossing, crew duty time limits, and airport curfew handling.

## Gap

Aviation has the hardest timezone-crossing problem in transport: a single flight can cross multiple timezones, crew have legal duty-time limits that span timezone boundaries, and airports have curfew windows that are local to the airport.

## Scope

- `packages/gmt/src/aviation/flight.ts`:
  - `flightLeg(departure: string, arrival: string, options?: { departureZone?: string, arrivalZone?: string }): { duration: string, zonesCrossed: number, localDeparture: string, localArrival: string }` — Computes flight duration, zones crossed, and zone-local departure/arrival times.
  - `crewDutyWindow(start: string, end: string, maxHours: number): { withinLimit: boolean, remaining: string }` — Given crew duty start and end times, checks if within legal limit. Returns whether within limit and remaining allowable time.
  - `airportCurfew(isoString: string, airport: string): { inCurfew: boolean, curfewStart: string, curfewEnd: string }` — Checks if a timestamp falls within an airport's curfew window.

## Airport curfew data (Phase 1)

| Airport | Code | Curfew (local) |
|---------|------|---------------|
| Heathrow | EGLL | 23:00–06:00 |
| Frankfurt | EDDF | 23:00–05:00 |
| Sydney | YSSY | 23:00–06:00 |
| Narita | RJAA | 22:30–06:30 |

## Design notes

- `zonesCrossed` counts timezone transitions (not degrees of longitude).
- `maxHours` is passed by the caller (FAA vs EASA vs airline-specific). GMT does not hardcode limits.
- Curfew data: hardcoded static table for Phase 1. Plan for external API.
- Airport codes are ICAO 4-letter codes.

## What gmt provides (do not re-implement)

- `transitTime` from TRAN-1 — flight duration calculation
- `convertZonedToZoned` — timezone conversion
- `getZonedDateTimeFields` — time extraction

## Verification

- `flightLeg` returns correct duration for a known flight
- `crewDutyWindow` correctly identifies within/over limit
- `airportCurfew` returns `inCurfew: true` during curfew hours
- Unknown airport: `inCurfew: false`, curfewStart/End are `""`
- `pnpm run validate` stays green
