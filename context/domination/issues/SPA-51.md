# SPA-51 — Space: Mission clocks, orbital epochs and light time

**Scope:** Spacecraft clocks, mission elapsed time, orbit-message epochs (CCSDS OMM first, TLE as a national peer), GNSS week decomposition, and the light-time relations between ground and spacecraft event times.

## Gap

Operational spacecraft do not timestamp in UTC. They count in their own clock units, and turning that into a usable time requires a correlation supplied by the ground segment. Meanwhile the most widely published orbital data format in existence encodes its epoch in a form nothing parses, and every deep-space timestamp exists in at least two frames — when it happened at the spacecraft, and when the signal reached Earth.

- **Spacecraft clock (SCLK)** is a free-running counter. Converting it to spacecraft event time (SCET) needs a correlation coefficient set — SPICE models this as an SCLK kernel.
- **Mission elapsed time (MET)** counts from launch, and is what mission timelines are written against.
- **Orbit-message epochs.** The international format is the CCSDS Orbit Mean-Elements Message (OMM, CCSDS 502.0-B, Orbit Data Messages), whose `EPOCH` is a CCSDS ASCII time code in the message's stated `TIME_SYSTEM` (the clause is not reached — marked, not asserted). The two-line element set (TLE), published by the United States, is the widest-circulated national format and is kept as a labelled peer: its epoch is `YYDDD.DDDDDDDD`, a two-digit year and a fractional day of year in columns 19–32 of line 1.
- **GNSS week plus time-of-week** is how satellite navigation receivers actually report, for every system that has a week counter, before any conversion.
- **Light time.** NAIF's CHRONOS defines the frames: SCET "is the time of an event on-board a spacecraft"; ERT "is the time of an event measured on the ground, such as the time when a signal about an event on-board of a spacecraft was received on the Earth"; ETT "is the time when a signal received on-board a spacecraft, was transmitted from the Earth"; LT "is the one-way light time between the Earth center of mass and a spacecraft", "computed using only Newtonian assumptions about the propagation of light". NASA's mission glossary gives the arithmetic — "Spacecraft Event Time, equal to ERT minus OWLT", "Round-Trip Light Time, elapsed time roughly equal to 2 x OWLT" — and calls the uplink time TRM where NAIF says ETT. Every DSN pass log carries all of these, and confusing them misplaces an event by minutes to hours.
  ([NAIF CHRONOS User's Guide, UTC time types](https://naif.jpl.nasa.gov/pub/naif/MER/misc/chronos/ver2/Sun_Solaris/chronos.ug), [NASA, *Basics of Space Flight*, glossary](https://science.nasa.gov/learn/basics-of-space-flight/glossary/), [NAIF SPICE `sclk.req`](https://naif.jpl.nasa.gov/naif/tutorials.html))

## Scope

Paths are under the Space realm namespace, written `<space-ns>/` below: its name is decided when the SPA stories start, because "space" would collide with a planned spatial/geo expansion.

- `<space-ns>/convert/omm.ts`:
  - `parseOmmEpoch(value: string): string` — An OMM `EPOCH` value to an ISO 8601 date-time label (no offset), read with SPA-52's CCSDS ASCII time-code parser. The label is in the message's `TIME_SYSTEM`, which the caller reads from the same message; converting it to UTC is `fromTAI`, `gnssToUtc` or the TT/TDB functions, by name. `""` on invalid input.
- `<space-ns>/convert/tle.ts`:
  - `parseTleEpoch(value: string, options: TwoDigitYearOptions): string | null` — `'24001.50000000'` to an ISO UTC instant. `options.yearWindow` is required, as INT-15 defines it: the first year of a fixed 100-year window, or `"rolling"`. Without it the result is the sentinel.
  - `formatTleEpoch(isoString: string): string` — Inverse.
- `<space-ns>/convert/missionElapsedTime.ts`:
  - `toMET(isoString: string, launchAt: string): number | null` — Seconds since launch. Negative before launch, which is the normal countdown case.
  - `fromMET(seconds: number, launchAt: string): string`
- `<space-ns>/convert/spacecraftClock.ts`:
  - `sclkToScet(sclkTicks: bigint, correlation: { atTicks: bigint, atInstant: string, tickRateSeconds: number, driftPerTick?: number }): string | null`
  - `scetToSclk(isoString: string, correlation): bigint | null`
- `<space-ns>/convert/lightTime.ts`:
  - `spacecraftEventTime(earthReceivedTime: string, oneWayLightTimeSeconds: number): string` — SCET = ERT − OWLT.
  - `earthReceivedTime(scet: string, oneWayLightTimeSeconds: number): string` — Inverse.
  - `spacecraftReceiveTime(earthTransmitTime: string, oneWayLightTimeSeconds: number): string` — When a command sent at ETT (NAIF) / TRM (DSN usage) arrives on board; both names appear in the JSDoc.
  - `roundTripLightTime(oneWayLightTimeSeconds: number): number` — `2 × OWLT`, the "roughly" in NASA's definition being the up- and down-leg difference the caller supplies separately if it matters.
  - `oneWayLightTime(rangeMetres: number): number` — Range divided by the defined speed of light, 299 792 458 m/s, Newtonian as CHRONOS states. Range is the caller's fact; GMT does not compute it.
- The GNSS week functions, `gnssWeekToUtc` / `utcToGnssWeek` and `rinexWeekToUtc` / `utcToRinexWeek`, come from MAR-16 (`gnss/convert/`); they are not reimplemented here.

## TLE epoch format

`YYDDD.DDDDDDDD` in columns 19–32 of line 1.

- `YY` — two-digit year. Publishers read it as **57–99 = 1957–1999 and 00–56 = 2000–2056**; GMT does not build that window in. A caller who wants it passes `{ yearWindow: 1957 }` by name.
- `DDD` — day of year, 1 to 365 or 366.
- `.DDDDDDDD` — fraction of the day from midnight UTC.

So `24001.50000000` is 2024-01-01 12:00 UTC.

([AMSAT keplerian formats](https://www.amsat.org/keplerian-elements-formats/), [Project Pluto TLE notes](https://www.projectpluto.com/tle_info.htm))

## Tool

**TLE Epoch and Light Time.** Paste a TLE and see its epoch decoded. Enter a distance to see the spacecraft event time, the Earth received time and the one-way light time. Calls `parseTleEpoch`, `spacecraftEventTime`, `earthReceivedTime`, `oneWayLightTime`.

## Design notes

- **No century is built in, not even the TLE convention's.** A fixed pivot is right today and wrong later: the publishers' 1957–2056 window stops working in 2057. So the year is read the way every GMT two-digit year is (`TwoDigitYearOptions` and `internal/twoDigitYear.ts`, from INT-15): the caller names a fixed window (`{ yearWindow: 1957 }` reproduces the publishers' convention, for archives) or `"rolling"` (the 100 years from 50 before the current UTC year to 49 after, for live element sets), and the function returns the sentinel without one. The JSDoc shows both and says why a historical archive should not use `"rolling"`.
- **OMM first, TLE as a peer.** New integrations should exchange CCSDS OMM; TLE support exists because most published element sets are still TLEs. The JSDoc labels TLE as a United States format.
- **`sclkToScet` requires a correlation and cannot invent one.** The tick rate and the reference point come from the ground segment; there is no default. This is the same principle as the FDP tables in AV-27 and the cut-off anchors in TRAN-10 — GMT supplies the arithmetic, the operator supplies the facts.
- **`driftPerTick` is optional** because many missions use a linear correlation and some need a drift term. Omitting it means no drift, stated explicitly rather than assumed.
- **Negative MET is valid** and is how every launch countdown is expressed. Returning a sentinel for pre-launch times would break the primary use case.
- **OWLT is an input, not a computation from an ephemeris.** Range comes from the navigation solution; `oneWayLightTime` is the only derived form, and it uses the SI defining constant so the JSDoc can state the exact arithmetic. Relativistic and atmospheric delay corrections are the navigation team's problem and are documented as not applied.
- TLE epochs are UTC and inherit leap-second behaviour; the fractional day is a fraction of a UTC day. An OMM epoch is in whatever `TIME_SYSTEM` the message states, so `parseOmmEpoch` returns a label, not an instant.
- The clock and light-time vocabulary follows CCSDS where it defines a term (CCSDS 503.0-B, Tracking Data Message — not reached — marked, not asserted); NAIF CHRONOS and NASA's glossary (United States) are kept as corroboration.

## What gmt provides (do not re-implement)

- `getOrdinalDate` from CORE-5 — day-of-year arithmetic
- `toNanoseconds` / `fromNanoseconds` from CORE-1 — precision conversion
- `gnssWeekToUtc` / `utcToGnssWeek` from MAR-16 — GNSS week decomposition, every system with a week counter
- `TwoDigitYearOptions` and `internal/twoDigitYear.ts` from INT-15 — the caller-stated or rolling window for the TLE year
- The CCSDS ASCII time-code parser from SPA-52 — the OMM `EPOCH` value
- `spanMs` from CORE-2 — MET calculation
- `addDuration` / `subtractDuration` — light-time shifts

## Verification

- `parseOmmEpoch('2024-01-01T12:00:00')` and the day-of-year form `parseOmmEpoch('2024-001T12:00:00')` both return `'2024-01-01T12:00:00'`; a malformed value returns `""`
- `parseTleEpoch('24001.50000000', { yearWindow: 1957 })` returns 2024-01-01 12:00 UTC
- With `{ yearWindow: 1957 }`, `'57001.00000000'` returns a 1957 date and `'56001.00000000'` a 2056 date; with `{ yearWindow: 2000 }`, `'57001.00000000'` returns a 2057 date, asserted to show the window matters
- With `{ yearWindow: 'rolling' }` and the clock mocked to 2026, `'57001.00000000'` returns a 2057 date (window 1976–2075) and `'24001.50000000'` a 2024 date
- `parseTleEpoch('24001.50000000')` with no `yearWindow` returns the sentinel
- Round-trip through `formatTleEpoch` preserves the epoch to the format's precision
- A TLE epoch in a leap year with day 366 parses correctly
- `toMET` before launch returns a negative value
- Round-trip: `fromMET(toMET(iso, launch), launch)` returns the original instant
- `sclkToScet` with a known correlation recovers the reference instant at the reference tick
- A non-zero `driftPerTick` produces a result differing from the linear case, asserted
- `spacecraftEventTime(earthReceivedTime(scet, owlt), owlt)` returns `scet` to nanosecond precision
- `oneWayLightTime(299792458)` returns exactly `1`; a Mars-distance range (about 2.25 × 10¹¹ m) returns roughly 750 seconds, asserted against the constant, not a literal
- Malformed TLE epochs, missing correlations and negative ranges return the sentinel
- `pnpm run validate` stays green
