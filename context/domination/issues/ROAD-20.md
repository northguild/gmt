# ROAD-20 — Road: FMCSA hours of service

**Scope:** US federal driver hours-of-service limits as time arithmetic over a duty-status log.

## Gap

Road is the largest logistics mode by volume and had no realm at all, while aviation crew duty was specced from the start. Hours-of-service compliance is pure interval arithmetic over a duty-status timeline, and it is safety-critical, legally enforced and universally implemented badly.

## Scope

- `packages/gmt/src/road/calculate/fmcsaStatus.ts`:
  - `fmcsaStatus(log: DutyEntry[], at: string, options: { cycle: '60/7' | '70/8', timeZone: string }): { drivingRemaining: string, windowRemaining: string, cycleRemaining: string, breakDue: string | null, violations: Violation[] } | null`
- `packages/gmt/src/road/calculate/fmcsaLimits.ts`:
  - `nextRequiredBreak(log: DutyEntry[], at: string): string | null` — When the 30-minute interruption becomes due.
  - `earliestNextDrive(log: DutyEntry[], at: string, options): string` — Earliest legal resumption after a limit is reached.
  - `restartAvailableAt(log: DutyEntry[], options): string | null` — When a 34-hour restart completes.
- `DutyEntry` is `{ status: 'off' | 'sleeper' | 'driving' | 'onDuty', start: string, end: string }`.

## FMCSA limits (property-carrying drivers)

| Limit | Rule |
| --- | --- |
| Driving | 11 hours maximum, after 10 consecutive hours off duty |
| Window | Driving not permitted beyond the 14th consecutive hour after coming on duty |
| Break | 30-minute interruption required after 8 cumulative hours of driving time |
| Cycle | 60 hours in 7 days, or 70 hours in 8 days |
| Restart | 34 consecutive hours off duty resets the cycle |

The 30-minute interruption may be satisfied by off-duty, sleeper-berth, or **on-duty-not-driving** time, or a combination — it is an interruption in driving status, not necessarily a rest.
([FMCSA](https://www.fmcsa.dot.gov/regulations/hours-of-service), [FMCSA one-pager](https://www.fmcsa.dot.gov/sites/fmcsa.dot.gov/files/2020-05/FMCSA_HoursOfService_OnePage.pdf))

## Design notes

- **The 14-hour window is elapsed time, not on-duty time.** Off-duty breaks inside the window do not extend it. This is the most commonly mis-implemented rule and the reason `windowRemaining` is returned separately from `drivingRemaining`.
- **The break is against cumulative driving, not elapsed time.** Eight hours of driving spread across twelve hours still triggers it.
- **The cycle is a rolling window** over 7 or 8 days, not a calendar week. Day boundaries are local, so the timezone is required — a driver crossing from Denver to Chicago does not get a shorter day.
- Sleeper-berth splitting and the adverse-conditions and short-haul exceptions are **not** in scope for this story. Document them as unimplemented rather than approximating them; a wrong exception is worse than an absent one.
- GMT reports remaining time and violations. It does not decide whether to dispatch.

## What gmt provides (do not re-implement)

- `mergeIntervals` / `subtractIntervals` / `sumIntervals` from CORE-6 — duty-status interval math
- `bucketRange` / `floorToZone` from CORE-5 — rolling day windows in local time
- `spanMs` from CORE-2 — elapsed time

## Verification

- 11 hours of driving inside a 14-hour window returns `drivingRemaining: 'PT0S'` with no violation
- An off-duty break inside the window does **not** extend `windowRemaining`
- 8 cumulative driving hours makes the break due; an on-duty-not-driving 30-minute period satisfies it
- Driving in the 15th consecutive hour produces a window violation
- 60/7 and 70/8 cycles yield different `cycleRemaining` for the same log
- A 34-hour off-duty period resets the cycle; 33 hours 59 minutes does not
- A log crossing a timezone boundary uses local day boundaries
- Overlapping or inverted duty entries return the sentinel
- `pnpm run validate` stays green
