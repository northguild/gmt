# MAR-1 — Maritime: GPS ↔ UTC conversion — `gpsToUtc` + `utcToGps`

**Scope:** GPS and UTC dual-mode timestamps. Bridges Earth Reference and Space domains.

## Gap

Maritime AIS uses GPS time (which has no leap seconds). Ground/port operations use UTC. GMT needs to handle the conversion correctly.

## Scope

- `packages/gmt/src/maritime/gps.ts`:
  - `gpsToUtc(gpsString: string): string` — GPS timestamp → UTC ISO string. GPS is TAI - 19s (constant).
  - `utcToGps(utcString: string): string` — UTC → GPS timestamp.

## Key constants

- GPS epoch: 1980-01-06T00:00:00Z
- GPS − UTC = -18 seconds (as of 2024)
- TAI − GPS = +19 seconds (constant)
- UTC = TAI − leap_seconds

## What gmt provides (do not re-implement)

- `toNanoseconds` / `fromNanoseconds` — precision conversion
- Temporal for time arithmetic

## Verification

- Round-trip: `gpsToUtc(utcToGps(iso))` returns equivalent UTC ISO string
- `utcToGps(gpsToUtc(gps))` returns equivalent GPS string
- GPS epoch: `utcToGps('1980-01-06T00:00:00Z')` → `'1980-01-06T00:00:18Z'`
- Invalid input throws `RangeError`
- `pnpm run validate` stays green
