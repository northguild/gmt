# SPA-1 — Space / Celestial: TAI + GPS scale conversion

**Scope:** TAI (International Atomic Time) and GPS (Global Positioning System) time scale conversion. Easiest of the Space scales — both are constant offsets from UTC.

## Gap

Space systems store timestamps in TAI (continuous, no leap seconds) and GPS (no leap seconds, used by GNSS). GMT needs to convert between these scales and UTC.

## Scope

- `packages/gmt/src/space/taigps.ts`:
  - `toTAI(isoString: string): string` — ISO UTC → TAI scale string. Format: `'2026-01-01T00:00:37 TAI'` (SPICE-style).
  - `fromTAI(taiString: string): string` — TAI → ISO UTC.
  - `toGPS(isoString: string): string` — ISO UTC → GPS scale string. Format: `'2026-01-01T00:00:00 GPS'`.
  - `fromGPS(gpsString: string): string` — GPS → ISO UTC.

## Key constants

- TAI − UTC = +37 seconds (as of 2024, updates with each leap second)
- GPS − UTC = -18 seconds (as of 2024)
- TAI − GPS = +19 seconds (constant)
- The UTC−TAI offset changes with each leap second. Use the IERS leap second table.

## String format

SPICE-style scale designators:
```
'2026-01-01T00:00:37 TAI'   — TAI scale
'2026-01-01T00:00:00 GPS'   — GPS scale
```

## What gmt provides (do not re-implement)

- `toNanoseconds` / `fromNanoseconds` — precision conversion
- IERS leap second table (from CORE-1)

## Verification

- Round-trip: `fromTAI(toTAI(iso))` returns equivalent UTC ISO string
- Round-trip: `fromGPS(toGPS(iso))` returns equivalent UTC ISO string
- Known offset: `toTAI('2026-01-01T00:00:00Z')` → `'2026-01-01T00:00:37 TAI'`
- `toGPS('2026-01-01T00:00:18Z')` → `'2026-01-01T00:00:00 GPS'`
- Invalid input throws `RangeError`
- `pnpm run validate` stays green
