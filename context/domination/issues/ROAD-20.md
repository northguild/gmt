# ROAD-20 — Road: FMCSA hours of service

**Scope:** US federal driver hours-of-service limits as time arithmetic over a duty-status log.

## Gap

Road is the largest logistics mode by volume and had no realm at all, while aviation crew duty was specced from the start. Hours-of-service compliance is pure interval arithmetic over a duty-status timeline, and it is safety-critical, legally enforced and universally implemented badly.

The regulation's own day is not the local calendar day. A "24-hour period" is "any 24-consecutive-hour period beginning at the time designated by the motor carrier for the terminal from which the driver is normally dispatched", and the 7- and 8-day cycles are 7 or 8 of those periods, beginning "at the time designated by the motor carrier for a 24-hour period" ([49 CFR 395.2](https://www.law.cornell.edu/cfr/text/49/395.2)). Electronic logging devices record in the home terminal's time standard with a UTC offset, for a 24-hour period beginning at that carrier-designated time ([49 CFR 395 Subpart B, Appendix A §4.4.3 and §7.41](https://www.law.cornell.edu/cfr/text/49/appendix-A_to_subpart_B_of_part_395)). Any implementation that buckets by the driver's current local midnight is wrong twice over.

## Scope

- `packages/gmt/src/road/calculate/fmcsaStatus.ts`:
  - `fmcsaStatus(log: DutyEntry[], at: string, options: FmcsaOptions): { drivingRemaining: string, windowRemaining: string, cycleRemaining: string, breakDue: string | null, violations: Violation[] } | null`
- `packages/gmt/src/road/calculate/fmcsaLimits.ts`:
  - `nextRequiredBreak(log: DutyEntry[], at: string, options: FmcsaOptions): string | null` — When the 30-minute interruption becomes due.
  - `earliestNextDrive(log: DutyEntry[], at: string, options: FmcsaOptions): string` — Earliest legal resumption after a limit is reached.
  - `restartAvailableAt(log: DutyEntry[], options: FmcsaOptions): string | null` — When a 34-hour restart completes.
- `packages/gmt/src/road/get/dutyDay.ts`:
  - `dutyDayFor(instant: string, options: FmcsaOptions): Interval` — The carrier-designated 24-hour period an instant falls in.
- `DutyEntry` is `{ status: 'off' | 'sleeper' | 'driving' | 'onDuty', start: string, end: string }`, exported from `types/`. It is the duty-log shape every hours-of-work story in the epic reuses (ROAD-21, ROAD-62, MAR-60, RAI-63, HLTH-70).
- `FmcsaOptions` is `{ cycle: '60/7' | '70/8', homeTerminalZone: string, dayStartTime: string, driverType?: 'property' | 'passenger' }`. `dayStartTime` is a local wall time such as `'00:00'` or `'04:00'`; there is no default because the regulation gives none.

## FMCSA limits

| Limit | Property-carrying (49 CFR 395.3) | Passenger-carrying (49 CFR 395.5) |
| --- | --- | --- |
| Driving | 11 hours, after 10 consecutive hours off duty | 10 hours, after 8 consecutive hours off duty |
| Window | No driving beyond the 14th consecutive hour after coming on duty | No driving after 15 hours on duty |
| Break | 30-minute interruption after 8 cumulative hours of driving | — |
| Cycle | 60 hours in 7 days, or 70 hours in 8 days (§395.3(b)) | 60 hours in 7 days, or 70 hours in 8 days (§395.5(b)) |
| Restart | 34 consecutive hours off duty resets the cycle (§395.3(c)) | **None** — §395.5 has no restart provision |

The 30-minute interruption is "at least a consecutive 30-minute interruption in driving status" (§395.3(a)(3)(ii)) and may be satisfied by off-duty, sleeper-berth, or **on-duty-not-driving** time, or a combination — it is an interruption in driving status, not necessarily a rest.
([49 CFR 395.3](https://www.law.cornell.edu/cfr/text/49/395.3), [49 CFR 395.5](https://www.law.cornell.edu/cfr/text/49/395.5), [FMCSA summary](https://www.fmcsa.dot.gov/regulations/hours-of-service))

## Design notes

- **The day is the carrier's, not the map's.** `homeTerminalZone` and `dayStartTime` together define the 24-hour period per §395.2. A driver crossing from Denver to Chicago does not get a shorter day, and a carrier whose day starts at 04:00 does not get midnight buckets. `dutyDayFor` exists so consumers stop deriving this themselves.
- **The 14-hour window is elapsed time, not on-duty time.** Off-duty breaks inside the window do not extend it. This is the most commonly mis-implemented rule and the reason `windowRemaining` is returned separately from `drivingRemaining`.
- **The break is against cumulative driving, not elapsed time.** Eight hours of driving spread across twelve hours still triggers it.
- **The cycle is a rolling window** over 7 or 8 carrier-designated periods, not a calendar week.
- **Tachograph-style logs are UTC; limits are home-terminal local.** `DutyEntry` instants may carry any offset; every day boundary is computed in `homeTerminalZone`, matching what the ELD is required to record.
- **Exceptions are a separate story.** The sleeper-berth split (§395.1(g)), adverse driving conditions (§395.1(b)), the short-haul exception (§395.1(e)) and the 16-hour exception (§395.1(o)) are ROAD-61, which builds on this status model. Until it lands they are documented here as unimplemented rather than approximated; a wrong exception is worse than an absent one.
- GMT reports remaining time and violations. It does not decide whether to dispatch.

## What gmt provides (do not re-implement)

- `mergeIntervals` / `subtractIntervals` / `sumIntervals` from CORE-6 — duty-status interval math
- `bucketRange` / `floorToZone` from CORE-5 — rolling day windows in the home-terminal zone
- `resolveLocal` from CORE-4 — `dayStartTime` on a DST-transition day
- `spanMs` from CORE-2 — elapsed time

## Verification

- 11 hours of driving inside a 14-hour window returns `drivingRemaining: 'PT0S'` with no violation
- An off-duty break inside the window does **not** extend `windowRemaining`
- 8 cumulative driving hours makes the break due; an on-duty-not-driving 30-minute period satisfies it
- Driving in the 15th consecutive hour produces a window violation
- 60/7 and 70/8 cycles yield different `cycleRemaining` for the same log
- A 34-hour off-duty period resets the cycle; 33 hours 59 minutes does not
- `dutyDayFor` with `dayStartTime: '04:00'` returns a period starting at 04:00 home-terminal time, and a log spanning a US timezone crossing still buckets by the home terminal
- On the home terminal's spring-forward day a `dayStartTime` of `'02:30'` resolves per the documented CORE-4 policy rather than returning the sentinel or silently shifting
- `driverType: 'passenger'` applies 10/15, no 30-minute break and no 34-hour restart (`restartAvailableAt` returns the sentinel), asserted against the same log
- Overlapping or inverted duty entries return the sentinel; missing `dayStartTime` returns the sentinel
- `pnpm run validate` stays green
