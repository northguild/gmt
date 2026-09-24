# SPA-74 — Space: TDB and TCB scale conversion

**Scope:** Barycentric Dynamical Time and Barycentric Coordinate Time — the solar-system scales whose relation to TT depends on the Julian Date.

## Gap

Solar-system ephemerides use TDB as the independent variable of motion; SPICE's "ephemeris time" is TDB. TDB differs from TT by a periodic relativistic correction of roughly 1.6 milliseconds, arising because a clock on Earth's surface moves through the Sun's gravitational potential. TCB, the coordinate time of the barycentric system, differs from TDB by a constant rate fixed by IAU resolution.

Both need the two-part Julian Date (SPA-49): the TDB − TT series is a function of the date, and the TCB relation is linear in JD from a fixed epoch. That dependency is why this story exists apart from SPA-47, whose scales (TT, TCG) need no JD.

## Scope

- `packages/gmt/src/space/convert/tdb.ts`:
  - `toTDB(isoString: string): string` — ISO UTC to a TDB scale string.
  - `fromTDB(tdbString: string): string` — TDB to ISO UTC.
  - `tdbMinusTt(isoString: string): number` — The correction in seconds, exposed so callers can see the magnitude they are accepting.
- `packages/gmt/src/space/convert/tcb.ts`:
  - `toTCB(isoString: string): string` — ISO UTC to a TCB scale string.
  - `fromTCB(tcbString: string): string`
  - `tcbMinusTdb(isoString: string): number` — The accumulated rate difference in seconds.

## Key constants

- **TDB − TT** is periodic, amplitude roughly 1.6 ms, dominated by Earth's orbital eccentricity.
- **TDB = TCB − L_B × (JD_TCB − T₀) × 86400 + TDB₀**, with **L_B = 1.550519768 × 10⁻⁸**, **TDB₀ = −6.55 × 10⁻⁵ s**, **T₀ = 2443144.5003725** (IAU 2006 Resolution B3).

## TDB − TT correction

The simplified formula, accurate to roughly 50 µs:

```text
TDB - TT = 0.001657 * sin(g) + 0.000022 * sin(l - l_j)
where g is the Earth's mean anomaly
```

A first implementation may use the leading term alone. The full Fairhead & Bretagnon (1990) series, as implemented in ERFA and SOFA, reaches better than 10 ns and is parked as a later story — see [../painpoints.md](../painpoints.md).

B3's own words: "TDB = TCB − L_B × (JD_TCB − T₀) × 86400 + TDB₀, where T₀ = 2443144.5003725, and L_B = 1.550519768 × 10⁻⁸ and TDB₀ = −6.55 × 10⁻⁵ s are defining constants"; T₀ is "the event 1977 January 1 00h 00m 00s TAI at the geocenter". The IERS Conventions restate it as eq. (10.3).

([IAU 2006 Resolution B3](https://iauarchive.eso.org/static/resolutions/IAU2006_Resol3.pdf), [IERS Conventions (2010), Chapter 10, eq. (10.3)](https://iers-conventions.obspm.fr/content/chapter10/tn36_c10.pdf), [NAIF SPICE time subsystem](https://naif.jpl.nasa.gov/naif/tutorials.html))

## String format

```text
'2026-01-01T00:00:00 TDB'
'2026-01-01T00:00:00 TCB'
```

## Design notes

- **`tdbMinusTt` is exported deliberately.** A caller working at millisecond precision needs to know the correction is being applied and how large it is; a caller at 50 µs needs to know the approximation's error bound exceeds their tolerance. Hiding it inside the conversion makes the accuracy limit invisible.
- **The accuracy limit must be in the JSDoc**, stated as a number. "Approximate" is not actionable.
- TDB is a barycentric scale and TT is geocentric. For solar-system ephemerides TDB is the correct argument, and substituting TT introduces the full 1.6 ms error. Note the distinction rather than assuming callers know it.
- **The Julian Date input must not lose precision** — use the two-part form from SPA-49 for both the TDB series argument and the TCB linear term; the TCB rate accumulates about 0.49 s per year, so a 100 µs JD floor is visible in the result.
- **TCB is exact given TDB; TDB is approximate given TT.** The JSDoc for `toTCB` states that its error is the TDB series error, not its own.

## Corrections

This story holds the TDB half of the original SPA-47. The split resolves the SPA-47 ⇄ SPA-49 mutual dependency the tracker flagged: SPA-47 now covers the JD-free scales (TT, TCG), SPA-49 depends on it alone, and this story depends on both.

## What gmt provides (do not re-implement)

- `toTT` / `fromTT` from SPA-47 — the geocentric scale TDB is corrected from
- `toJulianDateParts` from SPA-49 — the two-part JD both formulae take
- `toNanoseconds` / `fromNanoseconds` from CORE-1 — precision conversion

## Verification

- Round-trip for TDB returns an equivalent UTC string to within the documented tolerance
- `tdbMinusTt` peaks near the documented amplitude and changes sign across the year
- `tdbMinusTt` at two dates six months apart has opposite signs
- The TDB correction is computed from a two-part JD, asserted by comparing against a single-double computation at a date where they diverge
- `tcbMinusTdb` at T₀ equals `TDB₀` (−65.5 µs) to nanosecond precision, and grows by `L_B × 365 × 86400` seconds per 365 days, asserted against the IAU constants
- Round-trip for TCB returns an equivalent UTC string to nanosecond precision beyond the TDB tolerance
- A date before 1972-01-01 returns the sentinel (inherited from SPA-46)
- `pnpm run validate` stays green
