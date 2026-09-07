# INT-1 — Intermodal: Container tracking — `containerLeg` + `portDwell` + `customsClearance`

**Scope:** Container tracking across ocean and land legs with port dwell and customs clearance windows.

## Gap

Intermodal logistics involves containers moving across multiple transport modes (ship → truck → rail). Each handoff involves dwell time at ports, terminals, and customs facilities.

## Scope

- `packages/gmt/src/intermodal/container.ts`:
  - `containerLeg(leg: { mode: string, departure: string, duration: string, origin: string, destination: string }): { arrival: string, mode: string, origin: string, destination: string }` — Computes container arrival for a single leg. `mode` is `'ocean'`, `'truck'`, `'rail'`, or `'air'`.
  - `portDwell(entry: string, exit: string, port: string): { dwellHours: number, inFreeTime: boolean }` — Calculates dwell time at a port/terminal. `inFreeTime` is `true` if within the port's free time window (typically 3-5 days).
  - `customsClearance(arrival: string, port: string): { clearanceStart: string, clearanceEnd: string, estimatedHours: number }` — Estimates customs processing window for a given port.

## Port free time (Phase 1)

| Port | Free time (days) | Notes |
|------|-----------------|-------|
| Shanghai | 7 | Major container port |
| Rotterdam | 5 | European hub |
| Los Angeles | 5 | US West Coast |
| Singapore | 5 | Southeast Asian hub |

## What gmt provides (do not re-implement)

- `transitTime` from TRAN-1 — leg duration
- `dwellTime` from TRAN-1 — dwell calculation
- `etaAtZone` from TRAN-1 — zone-local time

## Verification

- `containerLeg` returns correct arrival time for known ocean leg
- `portDwell` correctly identifies within/over free time
- `customsClearance` returns reasonable estimated hours
- Invalid mode returns `""` sentinel
- `pnpm run validate` stays green
