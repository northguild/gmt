# SPA-47 — Space: TT and TDB scale conversion

**Scope:** Terrestrial Time and Barycentric Dynamical Time.

## Gap

Spacecraft navigation and orbital mechanics use TT and TDB as the independent variable of motion. TT is a constant offset from TAI. TDB differs from TT by a periodic relativistic correction of roughly 1.6 milliseconds, arising because a clock on Earth's surface moves through the Sun's gravitational potential.

## Scope

- `packages/gmt/src/space/convert/tt.ts`:
  - `toTT(isoString: string): string` — ISO UTC to a TT scale string.
  - `fromTT(ttString: string): string` — TT to ISO UTC.
- `packages/gmt/src/space/convert/tdb.ts`:
  - `toTDB(isoString: string): string` — ISO UTC to a TDB scale string.
  - `fromTDB(tdbString: string): string` — TDB to ISO UTC.
  - `tdbMinusTt(isoString: string): number` — The correction in seconds, exposed so callers can see the magnitude they are accepting.

## Key constants

- **TT = TAI + 32.184 seconds**, exact and constant by definition.
- **TDB − TT** is periodic, amplitude roughly 1.6 ms, dominated by Earth's orbital eccentricity.

## TDB − TT correction

The simplified formula, accurate to roughly 50 µs:

```
TDB - TT = 0.001657 * sin(g) + 0.000022 * sin(l - l_j)
where g is the Earth's mean anomaly
```

A first implementation may use the leading term alone. The full Fairhead & Bretagnon (1990) series, as implemented in ERFA and SOFA, reaches better than 10 ns and is parked as a later story — see [../painpoints.md](../painpoints.md).

## String format

```
'2026-01-01T00:00:00 TT'
'2026-01-01T00:00:00 TDB'
```

## Design notes

- **`tdbMinusTt` is exported deliberately.** A caller working at millisecond precision needs to know the correction is being applied and how large it is; a caller at 50 µs needs to know the approximation's error bound exceeds their tolerance. Hiding it inside the conversion makes the accuracy limit invisible.
- **The accuracy limit must be in the JSDoc**, stated as a number. "Approximate" is not actionable.
- TDB is a barycentric scale and TT is geocentric. For solar-system ephemerides TDB is the correct argument, and substituting TT introduces the full 1.6 ms error. Note the distinction rather than assuming callers know it.
- The Julian Date input to the correction formula must not lose precision — use the two-part form from SPA-49.

## What gmt provides (do not re-implement)

- `toTAI` / `fromTAI` from SPA-46 — TT is a constant offset from TAI
- `toJulianDateParts` from SPA-49 — the two-part JD the correction formula needs
- `toNanoseconds` / `fromNanoseconds` from CORE-1 — precision conversion

## Verification

- `toTT('2026-01-01T00:00:00Z')` returns `'2026-01-01T00:00:32.184 TT'` offset from TAI exactly
- TT minus TAI is exactly 32.184 seconds for every test date
- Round-trip for TT returns an equivalent UTC string
- Round-trip for TDB returns an equivalent UTC string to within the documented tolerance
- `tdbMinusTt` peaks near the documented amplitude and changes sign across the year
- `tdbMinusTt` at two dates six months apart has opposite signs
- The TDB correction is computed from a two-part JD, asserted by comparing against a single-double computation at a date where they diverge
- `pnpm run validate` stays green
