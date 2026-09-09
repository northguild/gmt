# SPA-51 — Space: Mission clocks and orbital epochs

**Scope:** Spacecraft clocks, mission elapsed time, TLE epochs and GPS week decomposition.

## Gap

Operational spacecraft do not timestamp in UTC. They count in their own clock units, and turning that into a usable time requires a correlation supplied by the ground segment. Meanwhile the most widely published orbital data format in existence encodes its epoch in a form nothing parses.

- **Spacecraft clock (SCLK)** is a free-running counter. Converting it to spacecraft event time (SCET) needs a correlation coefficient set — SPICE models this as an SCLK kernel.
- **Mission elapsed time (MET)** counts from launch, and is what mission timelines are written against.
- **TLE epochs** use `YYDDD.DDDDDDDD`: a two-digit year and a fractional day of year, in columns 19–32 of line 1. Every published element set is dated this way.
- **GPS week plus time-of-week** is how GNSS receivers actually report, before any conversion.

## Scope

- `packages/gmt/src/space/convert/tle.ts`:
  - `parseTleEpoch(value: string): string | null` — `'24001.50000000'` to an ISO UTC instant.
  - `formatTleEpoch(isoString: string): string` — Inverse.
- `packages/gmt/src/space/convert/missionElapsedTime.ts`:
  - `toMET(isoString: string, launchAt: string): number | null` — Seconds since launch. Negative before launch, which is the normal countdown case.
  - `fromMET(seconds: number, launchAt: string): string`
- `packages/gmt/src/space/convert/spacecraftClock.ts`:
  - `sclkToScet(sclkTicks: bigint, correlation: { atTicks: bigint, atInstant: string, tickRateSeconds: number, driftPerTick?: number }): string | null`
  - `scetToSclk(isoString: string, correlation): bigint | null`
- `packages/gmt/src/space/convert/gpsWeek.ts` — re-exported from MAR-16; not reimplemented.

## TLE epoch format

`YYDDD.DDDDDDDD` in columns 19–32 of line 1.

- `YY` — two-digit year. By convention **57–99 mean 1957–1999 and 00–56 mean 2000–2056.**
- `DDD` — day of year, 1 to 365 or 366.
- `.DDDDDDDD` — fraction of the day from midnight UTC.

So `24001.50000000` is 2024-01-01 12:00 UTC.

([AMSAT keplerian formats](https://www.amsat.org/keplerian-elements-formats/), [Project Pluto TLE notes](https://www.projectpluto.com/tle_info.htm))

## Design notes

- **The TLE century pivot is 57, not 50 or 69.** It is anchored to Sputnik, since no element set predates 1957. Guessing the pivot silently misdates historical elements by a century, and the rule must be a documented constant rather than an inherited runtime default.
- **`sclkToScet` requires a correlation and cannot invent one.** The tick rate and the reference point come from the ground segment; there is no default. This is the same principle as the FDP tables in AV-27 and the filing rules in INT-13 — GMT supplies the arithmetic, the operator supplies the facts.
- **`driftPerTick` is optional** because many missions use a linear correlation and some need a drift term. Omitting it means no drift, stated explicitly rather than assumed.
- **Negative MET is valid** and is how every launch countdown is expressed. Returning a sentinel for pre-launch times would break the primary use case.
- TLE epochs are UTC and inherit leap-second behaviour; the fractional day is a fraction of a UTC day.

## What gmt provides (do not re-implement)

- `getOrdinalDate` from CORE-5 — day-of-year arithmetic
- `toNanoseconds` / `fromNanoseconds` from CORE-1 — precision conversion
- `gpsWeekToUtc` / `utcToGpsWeek` from MAR-16 — GPS week decomposition
- `spanMs` from CORE-2 — MET calculation

## Verification

- `parseTleEpoch('24001.50000000')` returns 2024-01-01 12:00 UTC
- `parseTleEpoch('57001.00000000')` returns a 1957 date, not 2057
- `parseTleEpoch('56001.00000000')` returns a 2056 date
- Round-trip through `formatTleEpoch` preserves the epoch to the format's precision
- A TLE epoch in a leap year with day 366 parses correctly
- `toMET` before launch returns a negative value
- Round-trip: `fromMET(toMET(iso, launch), launch)` returns the original instant
- `sclkToScet` with a known correlation recovers the reference instant at the reference tick
- A non-zero `driftPerTick` produces a result differing from the linear case, asserted
- Malformed TLE epochs and missing correlations return the sentinel
- `pnpm run validate` stays green
