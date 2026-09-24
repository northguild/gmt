# ROAD-62 — Road: Canadian hours of service (SOR/2005-313)

**Scope:** The federal Commercial Vehicle Drivers Hours of Service Regulations, south and north of latitude 60°N, as time arithmetic over the same duty log as ROAD-20.

## Gap

US–Canada trucking is the largest cross-border road trade in the world, and a driver crossing at Windsor changes rule sets mid-shift. Canadian limits are neither FMCSA's nor the EU's: a 13-hour driving limit inside a 14-hour on-duty limit inside a 16-hour elapsed window, a daily off-duty requirement of 10 hours of which 8 consecutive, a mandatory 24-hour off-duty period in any 14 days, and two selectable cycles — 70 hours in 7 days or 120 hours in 14 days, the second requiring 24 consecutive hours off before the 70th hour. North of 60°N every number changes again.

Like FMCSA, the Canadian day is the carrier's: "a 24-hour period that begins at the hour designated by the motor carrier for the duration of the driver's cycle" (s. 1). Like FMCSA, the windows roll.

([Commercial Vehicle Drivers Hours of Service Regulations, SOR/2005-313, current to 2026-09-03](https://laws-lois.justice.gc.ca/eng/regulations/SOR-2005-313/))

## Scope

- `packages/gmt/src/road/calculate/canadaHosStatus.ts`:
  - `canadaHosStatus(log: DutyEntry[], at: string, options: { cycle: 1 | 2, region: 'south' | 'north', homeTerminalZone: string, dayStartTime: string }): { drivingRemaining: string, onDutyRemaining: string, windowRemaining: string, cycleRemaining: string, dailyOffDutyMet: boolean, offDuty24Due: string | null, violations: Violation[] } | null`
- `packages/gmt/src/road/calculate/canadaCycle.ts`:
  - `cycleResetAvailableAt(log, options): string | null` — When a reset completes: "for cycle 1, at least 36 consecutive hours; or (b) for cycle 2, at least 72 consecutive hours" (s. 28(1); s. 53 north).
  - `cycleSwitchPermitted(log, at, options): boolean` — Switching needs 36 consecutive hours off to go from cycle 1 to 2 and 72 to go from 2 to 1 (s. 29(1)).
  - `offDuty24Status(log, at, options): { satisfied: boolean, lastAt: string | null, requiredBy: string }` — The 24 consecutive hours off required in the preceding 14 days (s. 25).

## Limits

| Limit | South of 60°N (Part 2, ss. 12–29) | North of 60°N (Part 3, ss. 37–54) |
| --- | --- | --- |
| Driving per day | 13 hours (s. 12(1)) | 15 hours (s. 39(1)) |
| On-duty per day | 14 hours (s. 12(2)) | 18 hours (s. 39(1)) |
| Off duty after reaching either limit | at least 8 consecutive hours (s. 13(1)–(2)) | at least 8 consecutive hours (s. 39(1)) |
| Elapsed window between 8-hour off-duty periods | 16 hours (s. 13(3)) | 20 hours (s. 39(2)) |
| Daily off-duty | 10 hours, of which 8 consecutive and 2 more in blocks of no less than 30 minutes (s. 14) | 8 consecutive hours (s. 39(1)) |
| Off-duty in the preceding 14 days | 24 consecutive hours (s. 25) | section to be cited at implementation — not fetched |
| Cycle 1 | 70 hours on duty in any period of 7 days (s. 26) | 80 hours in any period of 7 days (s. 51) |
| Cycle 2 | 120 hours in any period of 14 days, and no more than 70 hours "without having taken at least 24 consecutive hours of off-duty time" (s. 27) | 120 hours in 14 days, and no more than **80** hours without a 24-hour off-duty period (s. 52) |
| Cycle reset | 36 consecutive hours (cycle 1), 72 (cycle 2); "the accumulated hours are set back to zero" (s. 28) | as south (s. 53) |

Sections 38 and 40 were repealed by SOR/2019-165 and must not be cited.

## Design notes

- **Three nested limits, three remaining values.** Driving, on-duty and the elapsed window bound each other (13 within 14 within 16); returning all three separately is what lets a dispatcher see which one binds, and it is the FMCSA `windowRemaining` lesson applied again.
- **The day is the carrier's**, as in ROAD-20, and `dayStartTime` has no default.
- **The daily off-duty rule has two parts.** Eight consecutive hours satisfy s. 13 but not s. 14: the remaining two hours must be taken in blocks of at least 30 minutes and must not form part of the 8-hour period (s. 14(3)). An engine that only checks for eight consecutive hours passes an illegal day.
- **Cycle 2's 24-hour precondition is a rule about the past**, not a limit: a driver who reaches 70 hours (80 north) in cycle 2 without a 24-hour off-duty period since the cycle began is in violation from that hour. It cannot be derived from a running total, which is why the log is the input.
- **Region is a parameter, not a coordinate.** GMT does not know where 60°N is on a route; the carrier says which part of the regulations applies to the day.
- Oil-well service permits, ferry crossings, adverse conditions and emergencies are out of scope; documented as unimplemented rather than approximated.

## What gmt provides (do not re-implement)

- `DutyEntry` / `dutyDayFor` from ROAD-20 — the duty-log shape and the carrier-designated day
- `mergeIntervals` / `subtractIntervals` / `sumIntervals` from CORE-6 — interval math
- `bucketRange` / `floorToZone` from CORE-5 — rolling day windows
- `spanMs` from CORE-2 — elapsed time

## Verification

- 13 hours of driving inside a 14-hour on-duty day returns `drivingRemaining: 'PT0S'` and no violation; a 14th driving hour is a violation citing s. 12(1)
- 14 hours on duty with 2 hours of off-duty breaks inside a 16-hour window is legal; driving after the 16th elapsed hour is a violation citing s. 13(3) even with on-duty time remaining
- A day with 10 hours off duty as 8 + 2 in one block passes; 8 + four 30-minute blocks passes; 8 + 1 + 1 in 20-minute blocks fails s. 14(2); 6 + 4 fails s. 13
- Cycle 1 at 70 hours in 7 carrier-designated days returns `cycleRemaining: 'PT0S'`; a 36-hour off-duty period resets it, 35 hours 59 minutes does not
- Cycle 2 reaching 70 hours with no 24-hour off-duty period since the cycle began produces a violation citing s. 27(b); with one it does not
- `cycleSwitchPermitted` from cycle 2 to cycle 1 is `false` after 36 hours off and `true` after 72
- `offDuty24Status` reports `satisfied: false` on the 15th day after the last 24-hour period
- `region: 'north'` applies 15/18/20 to the same log and reports different remaining values; its cycle 2 precondition fires at 80 hours, not 70 — both asserted
- Overlapping entries or a missing `dayStartTime` return the sentinel
- `pnpm run validate` stays green
