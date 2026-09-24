# SPA-50 — Space: UT1, DUT1, ΔT and sidereal time

**Scope:** Earth-rotation time — from IERS measurements where they exist and from the published ΔT polynomials where they do not — and the sidereal angles that depend on it.

## Gap

UTC is an atomic timescale kept within 0.9 s of Earth's rotation by leap seconds. **UT1 is Earth's actual rotation angle**, and the difference DUT1 = UT1 − UTC varies continuously and unpredictably as the planet speeds up and slows down.

Anything that points at the sky needs UT1, not UTC: Greenwich Mean and Apparent Sidereal Time and the Earth Rotation Angle all take UT1 as their argument. Using UTC instead introduces an error of up to 0.9 seconds of time, which is about 13 arcseconds of rotation — far beyond any pointing budget.

The epic bundles IERS **Bulletin C** (leap seconds) and not **Bulletin A** (Earth orientation), so UT1 is unreachable and sidereal time is absent entirely. Bulletin A also has a floor: it begins in 1973. For any earlier date — every historical eclipse, every archival observation — the only source is **ΔT = TT − UT1** from the piecewise polynomials Espenak and Meeus fitted for the *Five Millennium Canon of Solar Eclipses*, covering −1999 to +3000, with a stated fit error of at most 4 seconds only for −500 to +500 and otherwise "estimated from scatter in the measurements".

([IERS Bulletin A](https://www.iers.org/IERS/EN/Publications/Bulletins/bulletins.html), [Espenak & Meeus, *Polynomial Expressions for Delta T*, NASA GSFC](https://eclipse.gsfc.nasa.gov/SEcat5/deltatpoly.html))

## Scope

- `packages/gmt/src/space/get/ut1.ts`:
  - `dut1At(isoString: string): number | null` — DUT1 in seconds for a date, from bundled Bulletin A data.
  - `toUT1(isoString: string, options?: { dut1?: number }): string` — UTC to UT1. An explicit `dut1` overrides the table, for callers with fresher data.
  - `ut1Provenance(): { source: string, bulletin: string, validUntil: string }`
  - `isUt1Stale(at: string): boolean`
- `packages/gmt/src/space/calculate/deltaT.ts`:
  - `deltaT(isoDate: string, options?: { source?: 'measured' | 'polynomial' | 'auto' }): { seconds: number, source: 'bulletinA' | 'polynomial', uncertaintySeconds: number | null } | null` — TT − UT1. `'auto'` uses Bulletin A where the table covers the date and the Espenak–Meeus polynomial otherwise; `uncertaintySeconds` is `4` for −500…+500 and `null` elsewhere, because the source gives no other number.
  - `deltaTPolynomial(decimalYear: number): number` — The piecewise expression alone, with `y = year + (month − 0.5) / 12` as the source defines it.
- `packages/gmt/src/space/calculate/siderealTime.ts`:
  - `earthRotationAngle(isoString: string, options?: { dut1?: number }): number | null` — ERA in radians.
  - `greenwichMeanSiderealTime(isoString: string, options?): number | null` — GMST in radians.
  - `greenwichApparentSiderealTime(isoString: string, options?): number | null` — GAST, GMST plus the equation of the equinoxes.
  - `localSiderealTime(isoString: string, longitudeDegrees: number, options?): number | null`

## ΔT polynomial segments (Espenak & Meeus)

| Years | Expression (ΔT in seconds) |
| --- | --- |
| y < −500 | `−20 + 32u²`, `u = (y − 1820) / 100` |
| −500 … +500 | `10583.6 − 1014.41u + 33.78311u² − 5.952053u³ − 0.1798452u⁴ + 0.022174192u⁵ + 0.0090316521u⁶`, `u = y / 100` (error ≤ 4 s) |
| +500 … +1600 | `1574.2 − 556.01u + 71.23472u² + 0.319781u³ − 0.8503463u⁴ − 0.005050998u⁵ + 0.0083572073u⁶`, `u = (y − 1000) / 100` |
| 1600 … 1700 | `120 − 0.9808t − 0.01532t² + t³ / 7129`, `t = y − 1600` |
| 1700 … 1800 | `8.83 + 0.1603t − 0.0059285t² + 0.00013336t³ − t⁴ / 1174000`, `t = y − 1700` |
| 1800 … 1860 | `13.72 − 0.332447t + 0.0068612t² + 0.0041116t³ − 0.00037436t⁴ + 0.0000121272t⁵ − 0.0000001699t⁶ + 0.000000000875t⁷`, `t = y − 1800` |
| 1860 … 1900 | `7.62 + 0.5737t − 0.251754t² + 0.01680668t³ − 0.0004473624t⁴ + t⁵ / 233174`, `t = y − 1860` |
| 1900 … 1920 | `−2.79 + 1.494119t − 0.0598939t² + 0.0061966t³ − 0.000197t⁴`, `t = y − 1900` |
| 1920 … 1941 | `21.20 + 0.84493t − 0.076100t² + 0.0020936t³`, `t = y − 1920` |
| 1941 … 1961 | `29.07 + 0.407t − t² / 233 + t³ / 2547`, `t = y − 1950` |
| 1961 … 1986 | `45.45 + 1.067t − t² / 260 − t³ / 718`, `t = y − 1975` |
| 1986 … 2005 | `63.86 + 0.3345t − 0.060374t² + 0.0017275t³ + 0.000651814t⁴ + 0.00002373599t⁵`, `t = y − 2000` |
| 2005 … 2050 | `62.92 + 0.32217t + 0.005589t²`, `t = y − 2000` |
| 2050 … 2150 | `−20 + 32((y − 1820) / 100)² − 0.5628(2150 − y)` |
| y > 2150 | `−20 + 32u²`, `u = (y − 1820) / 100` |

## Design notes

- **DUT1 is predicted, not derived.** Bulletin A publishes measurements and short-term predictions; beyond the prediction horizon there is no correct value. `isUt1Stale` and an overridable `dut1` exist because the bundled table is guaranteed to go out of date, and a silently stale DUT1 is a silently mispointed antenna.
- **ΔT from a polynomial is a fit, and says so.** The 2005–2050 segment was fitted to *estimated* values for 2010 and 2050 and is an extrapolation for every year after the source was written; `deltaT` in `'auto'` mode therefore prefers Bulletin A for every date the table covers and reports `source` so a caller can tell a measurement from a fit. Where the source states no uncertainty, `uncertaintySeconds` is `null`, not a guess.
- **UT1 and ΔT are one quantity seen from two sides.** DUT1 = UT1 − UTC and ΔT = TT − UT1 are linked through TT − UTC = 32.184 s + (TAI − UTC); `toUT1` for a pre-1973 date goes through `deltaT` and the leap-second table (SPA-48) is not consulted before 1972, consistent with SPA-46's sentinel.
- **Bulletin A and Bulletin C are different products** solving different problems. The epic conflated Earth-orientation data with leap-second data; they have different cadences, different validity windows and different consumers.
- **Angles are returned in radians**, matching SOFA and ERFA convention, so callers composing with an astronomy library do not convert twice. Stated explicitly because degrees would be the intuitive guess.
- **GAST requires the equation of the equinoxes**, which depends on nutation. A first implementation may use a truncated nutation series, and the accuracy limit must be documented as a number — the same discipline as the TDB correction in SPA-74.
- Polar motion (x, y) also appears in Bulletin A and is required for full terrestrial-to-celestial transformation. It is out of scope here and noted as parked; this story delivers rotation about the pole only.

## What gmt provides (do not re-implement)

- `toJulianDateParts` from SPA-49 — sidereal formulae take a two-part JD and are precision-sensitive
- `toTT` from SPA-47 — GMST formulations mix UT1 and TT arguments
- `taiMinusUtc` from SPA-48 — the TT − UTC link for dates the leap-second table covers
- `toNanoseconds` from CORE-1 — precision conversion

## Verification

- `dut1At` returns a value within ±0.9 s for every date in the bundled table
- `toUT1` with an explicit `dut1` overrides the table value
- `isUt1Stale` returns `true` beyond the bulletin's prediction horizon
- `deltaTPolynomial(2000.0)` returns `63.86` and `deltaTPolynomial(1950.0)` returns `29.07` — the segment constants at their origins, asserted against the source
- `deltaT` for a date inside Bulletin A coverage returns `source: 'bulletinA'`; for 1850 it returns `source: 'polynomial'` with `uncertaintySeconds: null`; for the year 100 it returns `uncertaintySeconds: 4`
- `deltaT` and `dut1At` agree for a covered date through `TT − UTC = 32.184 + (TAI − UTC)`, asserted
- Adjacent polynomial segments agree at their shared boundary years to within the source's own discontinuity (the 2050 segment was "introduced to eliminate the discontinuity at 2050"), asserted at 1600, 1700, 1800, 1860, 1900, 1920, 1941, 1961, 1986, 2005 and 2150
- `earthRotationAngle` advances by approximately 2π over one sidereal day
- `greenwichMeanSiderealTime` at a known reference epoch matches a published value to the documented tolerance
- GAST and GMST differ by the equation of the equinoxes, and the difference is within its expected arcsecond range
- `localSiderealTime` at longitude 0 equals GAST
- Sidereal time computed from UTC rather than UT1 differs measurably, asserted to document why UT1 is required
- Invalid longitude returns the sentinel
- `pnpm run validate` stays green
