# SPA-53 — Space: Planetary time

**Scope:** Mars solar time — the sol-based clocks surface missions actually operate on.

## Gap

Mars surface missions run on local solar time at the landing site, because that is what governs solar power, thermal cycling and imaging. A Martian solar day is about 2.7% longer than Earth's, so mission clocks drift steadily against Earth time and cannot be derived from any terrestrial timescale.

This is the least commercially urgent story in the epic and the most differentiating: no general-purpose JavaScript date library does it.

## Scope

- `packages/gmt/src/space/convert/marsSolDate.ts`:
  - `toMarsSolDate(isoString: string): number | null` — Mars Sol Date from a UTC instant.
  - `fromMarsSolDate(msd: number): string` — Inverse.
- `packages/gmt/src/space/calculate/marsTime.ts`:
  - `airyMeanTime(isoString: string): { hours: number, minutes: number, seconds: number } | null` — Mean solar time at the Mars prime meridian.
  - `localMeanSolarTime(isoString: string, eastLongitudeDegrees: number): { hours: number, minutes: number, seconds: number } | null`
  - `missionSolNumber(isoString: string, landing: { at: string, eastLongitudeDegrees: number }, options?: { firstSol?: 0 | 1 }): number | null`

## Key constants

- **Mars mean solar day: 88 775.244 seconds** — 24 h 39 m 35.244 s.
- Mars Sol Date, from the J2000 offset in days:
  ```
  MSD = (ΔtJ2000 - 4.5) / 1.027491252 + 44796.0 - 0.00096
  ```
- The prime meridian passes through the crater **Airy-0**; mean solar time there is **Airy Mean Time**, the Martian analogue of GMT.
- Local mean solar time adds east longitude divided by 15, in Mars hours.

([NASA GISS Mars24 technical notes](https://www.giss.nasa.gov/tools/mars24/help/notes.html))

## Design notes

- **A Mars hour is not an Earth hour.** LMST divides the sol into 24 equal parts, so a Mars second is about 1.027 Earth seconds. Returning `{ hours, minutes, seconds }` rather than a duration or an ISO string keeps that distinction visible — an ISO time string would imply Earth seconds and be quietly wrong.
- **`missionSolNumber` needs the landing longitude**, not just the landing time, because the sol boundary is local. Different missions also disagree on whether landing day is Sol 0 or Sol 1, so `firstSol` is a parameter with a documented default rather than an assumption.
- **This is mean solar time, not true solar time.** LTST additionally requires the equation of time for Mars, which depends on its considerably larger orbital eccentricity. Out of scope; noted as parked.
- **Mars time is derived from TT via the J2000 offset**, so it inherits the precision requirements of SPA-49. Using a single-double Julian Date here compounds the ~100 µs floor.
- No Martian timescale has leap seconds. There is nothing to correct.

## What gmt provides (do not re-implement)

- `toJulianDateParts` / `toJ2000Seconds` from SPA-49 — the J2000 offset the MSD formula takes
- `toTT` from SPA-47 — the terrestrial scale underlying the conversion
- `toNanoseconds` from CORE-1 — precision conversion

## Verification

- `toMarsSolDate` at a published reference instant matches a known MSD to the documented tolerance
- Round-trip: `fromMarsSolDate(toMarsSolDate(iso))` returns an equivalent instant
- One sol later in MSD corresponds to 88 775.244 Earth seconds later, asserted
- `airyMeanTime` advances 24 Mars hours over exactly one sol
- `localMeanSolarTime` at east longitude 0 equals `airyMeanTime`
- `localMeanSolarTime` at east longitude 180 is offset by 12 Mars hours
- `missionSolNumber` returns 0 or 1 on the landing sol according to `firstSol`
- `missionSolNumber` increments at the site's local midnight, not at Airy midnight
- MSD computed from a two-part JD differs from the single-double computation at a date where they diverge, asserted
- `pnpm run validate` stays green
