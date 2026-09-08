# RAI-2 — Rail: UIC timing + dwell + shunting — `uicDwellTime` + `shuntingWindow`

**Scope:** Rail-specific timing operations: UIC 9602 dwell time, shunting windows.

## Gap

Rail operations have specific timing requirements: UIC 9602 defines how to calculate train running time and dwell, shunting windows are time windows for marshalling yard operations.

## Scope

- `packages/gmt/src/rail/timing.ts`:
  - `uicDwellTime(arrival: string, departure: string, station: string): number` — Calculates dwell time in minutes at a station using UIC 9602 conventions.
  - `shuntingWindow(available: string, operations: string[]): { earliest: string, latest: string, feasible: boolean }` — Given available time and list of shunting operations, computes the earliest start and latest start that fits all operations.

## UIC 9602

UIC leaflet 9602 defines:
- Running time: time between two stations
- Dwell time: time stopped at a station
- Technical stop: minimum time for operational reasons

## What gmt provides (do not re-implement)

- `spanMs` / `spanNs` from CORE-2 — duration calculation
- `addDuration` / `subtractDuration` — time arithmetic

## Verification

- `uicDwellTime` returns correct minutes for known arrival/departure
- `shuntingWindow` returns feasible schedule when operations fit
- `shuntingWindow` returns `feasible: false` when operations don't fit
- `pnpm run validate` stays green
