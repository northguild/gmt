# SPA-50 — Space: UT1, DUT1 and sidereal time

**Scope:** Earth-rotation time, and the sidereal angles that depend on it.

## Gap

UTC is an atomic timescale kept within 0.9 s of Earth's rotation by leap seconds. **UT1 is Earth's actual rotation angle**, and the difference DUT1 = UT1 − UTC varies continuously and unpredictably as the planet speeds up and slows down.

Anything that points at the sky needs UT1, not UTC: Greenwich Mean and Apparent Sidereal Time and the Earth Rotation Angle all take UT1 as their argument. Using UTC instead introduces an error of up to 0.9 seconds of time, which is about 13 arcseconds of rotation — far beyond any pointing budget.

The epic bundles IERS **Bulletin C** (leap seconds) and not **Bulletin A** (Earth orientation), so UT1 is unreachable and sidereal time is absent entirely.

## Scope

- `packages/gmt/src/space/get/ut1.ts`:
  - `dut1At(isoString: string): number | null` — DUT1 in seconds for a date, from bundled Bulletin A data.
  - `toUT1(isoString: string, options?: { dut1?: number }): string` — UTC to UT1. An explicit `dut1` overrides the table, for callers with fresher data.
  - `ut1Provenance(): { source: string, bulletin: string, validUntil: string }`
  - `isUt1Stale(at: string): boolean`
- `packages/gmt/src/space/calculate/siderealTime.ts`:
  - `earthRotationAngle(isoString: string, options?: { dut1?: number }): number | null` — ERA in radians.
  - `greenwichMeanSiderealTime(isoString: string, options?): number | null` — GMST in radians.
  - `greenwichApparentSiderealTime(isoString: string, options?): number | null` — GAST, GMST plus the equation of the equinoxes.
  - `localSiderealTime(isoString: string, longitudeDegrees: number, options?): number | null`

## Design notes

- **DUT1 is predicted, not derived.** Bulletin A publishes measurements and short-term predictions; beyond the prediction horizon there is no correct value. `isUt1Stale` and an overridable `dut1` exist because the bundled table is guaranteed to go out of date, and a silently stale DUT1 is a silently mispointed antenna.
- **Bulletin A and Bulletin C are different products** solving different problems. The epic conflated Earth-orientation data with leap-second data; they have different cadences, different validity windows and different consumers.
- **Angles are returned in radians**, matching SOFA and ERFA convention, so callers composing with an astronomy library do not convert twice. Stated explicitly because degrees would be the intuitive guess.
- **GAST requires the equation of the equinoxes**, which depends on nutation. A first implementation may use a truncated nutation series, and the accuracy limit must be documented as a number — the same discipline as the TDB correction in SPA-47.
- Polar motion (x, y) also appears in Bulletin A and is required for full terrestrial-to-celestial transformation. It is out of scope here and noted as parked; this story delivers rotation about the pole only.

## What gmt provides (do not re-implement)

- `toJulianDateParts` from SPA-49 — sidereal formulae take a two-part JD and are precision-sensitive
- `toTT` from SPA-47 — GMST formulations mix UT1 and TT arguments
- `toNanoseconds` from CORE-1 — precision conversion

## Verification

- `dut1At` returns a value within ±0.9 s for every date in the bundled table
- `toUT1` with an explicit `dut1` overrides the table value
- `isUt1Stale` returns `true` beyond the bulletin's prediction horizon
- `earthRotationAngle` advances by approximately 2π over one sidereal day
- `greenwichMeanSiderealTime` at a known reference epoch matches a published value to the documented tolerance
- GAST and GMST differ by the equation of the equinoxes, and the difference is within its expected arcsecond range
- `localSiderealTime` at longitude 0 equals GAST
- Sidereal time computed from UTC rather than UT1 differs measurably, asserted to document why UT1 is required
- Invalid longitude returns the sentinel
- `pnpm run validate` stays green
