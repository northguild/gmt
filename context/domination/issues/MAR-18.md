# MAR-18 — Maritime: Ship's time, clock changes and date line crossing

**Scope:** The ship's own clock, which is declared by the master and matches no IANA zone.

## Gap

A vessel on passage keeps three clocks: AIS and navigation report UTC, the deck log and crew roster run on **ship's time**, and the port runs on port-local time. Ship's time is set by the master, advanced or retarded by whole or half hours on passage, and need not correspond to any IANA zone or to the vessel's actual longitude. Crossing the International Date Line changes the date by a day in addition to any clock change.

GMT can represent IANA zones. It cannot represent a captain-declared offset, so a voyage's own log timestamps are currently unrepresentable.

## Scope

- `packages/gmt/src/maritime/convert/shipTime.ts`:
  - `toShipTime(instant: string, shipOffset: string): string` — Renders an instant in ship's time. `shipOffset` is `±HH:MM`, permitting half- and quarter-hour offsets.
  - `fromShipTime(shipLocal: string, shipOffset: string): string` — Ship's local wall time back to an instant.
- `packages/gmt/src/maritime/calculate/clockChange.ts`:
  - `applyClockChange(shipOffset: string, change: string): string` — Applies a retard (negative) or advance (positive) order to the ship's offset.
  - `shipTimeSchedule(departure: string, arrival: string, changes: { at: string, change: string }[], startOffset: string): { at: string, offsetBefore: string, offsetAfter: string }[]` — The offset in force across a voyage.
- `packages/gmt/src/maritime/calculate/dateLineCrossing.ts`:
  - `dateLineCrossing(instant: string, direction: 'westbound' | 'eastbound', shipOffset: string): { offsetAfter: string, dateChange: number }` — `dateChange` is `+1` or `-1` days.

## Design notes

- **`shipOffset` is an offset, not a zone**, and this is the one place in GMT where that is correct rather than a bug. There is no tzdb entry for "what the master ordered", and there is deliberately no attempt to map an offset back to an IANA zone — see CORE-4 on why an offset does not identify a zone.
- Offsets beyond ±14:00 exist at sea. Nautical time zones run to ±12, and a master may order an offset that no landmass uses. Validation permits the full ±14:00 range and half- and quarter-hour steps.
- **Crossing the date line is a date change, not a clock change**, and the two are independent: a vessel may cross the line without a clock order, or take a clock order without crossing. Modelling them separately is what keeps voyage logs reconcilable.
- Ship's time has no DST. It changes only by explicit order, so there are no ambiguous or nonexistent local times — a genuine simplification relative to CORE-4.

## What gmt provides (do not re-implement)

- `toOffsetInstant` / `fromOffsetInstant` from CORE-4 — the instant-plus-offset pair, which is exactly the ship's-time shape
- `addDuration` — offset arithmetic
- `mergeIntervals` from CORE-6 — building the offset-in-force timeline

## Verification

- `toShipTime` round-trips through `fromShipTime` for whole, half and quarter-hour offsets
- A one-hour retard order decreases the offset by one hour and repeats an hour of ship's time
- A one-hour advance order skips an hour of ship's time
- `shipTimeSchedule` returns offsets in force in chronological order across multiple changes
- Westbound date line crossing returns `dateChange: +1`; eastbound returns `-1`
- An offset beyond ±14:00 returns the sentinel
- A crossing with no clock change leaves the offset unchanged
- `pnpm run validate` stays green
