# SPA-4 — Space / Celestial: Julian Date and J2000 epoch

**Scope:** Julian Date (JD), Modified Julian Date (MJD), and J2000 epoch conversion. Standard astronomical time formats used in CCSDS and orbital mechanics.

## Gap

Space systems commonly use Julian Date for ephemeris and CCSDS orbit data messages. J2000 (seconds since 2000-01-01 12:00 TT) is the standard epoch for orbital mechanics.

## Scope

- `packages/gmt/src/space/julian.ts`:
  - `instantToJulianDate(isoString: string): number` — Convert to Julian Date. JD starts at noon (4713 BCE).
  - `instantFromJulianDate(jd: number): string` — Parse Julian Date → ISO UTC string.
  - `instantToModifiedJulianDate(isoString: string): number` — MJD = JD - 2400000.5.
  - `instantToJ2000Seconds(isoString: string, scale?: string): number` — Seconds since J2000 epoch (2000-01-01 12:00 TT). Default scale: TT.

## Key epochs

| Epoch | JD | Notes |
|-------|-----|-------|
| J2000 | 2451545.0 | 2000-01-01 12:00 TT |
| Modified JD | JD - 2400000.5 | Starts at midnight |
| Unix epoch | 2440587.5 | 1970-01-01 00:00 UTC |

## String format

```
'2026-01-01T00:00:00 JD'       — Julian Date (optional suffix)
'2026-01-01T00:00:00 MJD'      — Modified Julian Date
'2026-01-01T00:00:00 TT'       — J2000 seconds (default)
```

## CCSDS 502.0-B-3

CCSDS Orbit Data Messages use `TIME_SYSTEM` keywords. J2000 seconds are the standard for TDB ephemeris (SPICE ET convention).

## What gmt provides (do not re-implement)

- `toNanoseconds` / `fromNanoseconds` — precision conversion
- `toTT` from SPA-2 — J2000 is defined in TT

## Verification

- `instantToJulianDate('2000-01-01T12:00:00Z')` → `2451545.0` (± rounding)
- `instantFromJulianDate(2451545.0)` → equivalent ISO
- `instantToJ2000Seconds('2000-01-01T12:00:00Z')` → `0`
- `instantToModifiedJulianDate('2000-01-01T00:00:00Z')` → `51544.5`
- Invalid Julian Date throws `RangeError`
- `pnpm run validate` stays green
