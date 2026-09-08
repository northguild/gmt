# SPA-2 — Space / Celestial: TT + TDB scale conversion

**Scope:** TT (Terrestrial Time) and TDB (Barycentric Dynamical Time) conversion. TT adds a constant offset to TAI. TDB adds a periodic relativistic correction to TT.

## Gap

Spacecraft navigation and orbital mechanics use TT and TDB as the independent time variable. TT is the Earth-centered time scale; TDB is the solar-system-centered equivalent.

## Scope

- `packages/gmt/src/space/tttdb.ts`:
  - `toTT(isoString: string): string` — ISO UTC → TT scale string. TT = TAI + 32.184s (constant).
  - `fromTT(ttString: string): string` — TT → ISO UTC.
  - `toTDB(isoString: string): string` — ISO UTC → TDB scale string.
  - `fromTDB(tdbString: string): string` — TDB → ISO UTC.

## Key constants

- TT = TAI + 32.184 seconds (exact, constant)
- TDB ≈ TT + ~1.6ms periodic correction (relativistic)

## TDB-TT correction

Use the simplified formula for v1 (~50µs accuracy):
```
TDB - TT = 0.001657 * sin(2π * (JD - 2451545) / 365.25)
```
Full Fairhead & Bretagnon (1990) model (<10ns accuracy) as a future story.

## String format

```
'2026-01-01T00:00:00 TT'
'2026-01-01T00:00:00 TDB'
```

## What gmt provides (do not re-implement)

- `toNanoseconds` / `fromNanoseconds` — precision conversion
- `instantToJulianDate` — from SPA-4, needed for TDB formula

## Verification

- `toTT('2026-01-01T00:00:00Z')` → `'2026-01-01T00:00:32.184 TT'`
- Round-trip for TT: `fromTT(toTT(iso))` returns equivalent UTC
- Round-trip for TDB: `fromTDB(toTDB(iso))` returns equivalent UTC
- Invalid input throws `RangeError`
- `pnpm run validate` stays green
