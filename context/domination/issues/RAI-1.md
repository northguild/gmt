# RAI-1 — Rail: Rail schedules — `railLeg` + `crossBorderSchedule`

**Scope:** Rail-specific scheduling including cross-border timezone transitions.

## Gap

Rail transport has unique timezone challenges: some countries use a single timezone across multiple geographic zones (e.g., China uses Beijing Time across 5 timezones), and cross-border trains must handle different legal time systems.

## Scope

- `packages/gmt/src/rail/schedule.ts`:
  - `railLeg(departure: string, arrival: string, options?: { departureZone?: string, arrivalZone?: string, country?: string }): { duration: string, zonesCrossed: number, localDeparture: string, localArrival: string, usesSingleTZ: boolean }` — Computes rail leg duration and times. `usesSingleTZ` is `true` if the country uses a single legal time across multiple zones.
  - `crossBorderSchedule(departure: string, borderCrossing: string, destinationZone: string): { beforeBorder: string, afterBorder: string, transitionPoint: string }` — Handles timezone transition at border crossings.

## Single-timezone countries (Phase 1)

| Country | Single TZ | Notes |
|---------|-----------|-------|
| China | Asia/Shanghai (UTC+8) | Spans 5 geographic timezones |
| India | Asia/Kolkata (UTC+5:30) | Single timezone |
| Spain | Europe/Madrid (UTC+1) | Uses CET despite geographic position |

## What gmt provides (do not re-implement)

- `transitTime` from TRAN-1 — base duration calculation
- `convertZonedToZoned` — timezone conversion

## Verification

- `railLeg` correctly handles cross-border transitions
- `crossBorderSchedule` returns correct times before/after border
- Single-TZ country: `usesSingleTZ: true`
- Invalid border or zone returns `""` sentinel
- `pnpm run validate` stays green
