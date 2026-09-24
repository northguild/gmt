# ROAD-61 — Road: FMCSA hours-of-service exceptions

**Scope:** The four provisions of 49 CFR 395.1 that change the ROAD-20 arithmetic when they apply: the sleeper-berth provision, adverse driving conditions, the short-haul exception and the 16-hour exception.

## Gap

ROAD-20 deliberately excluded the exceptions rather than approximate them. That is the right order of work and the wrong final state: the sleeper-berth provision is how every team driver and most long-haul solo drivers actually operate, and an HOS engine that cannot pair a 7-hour berth period with a 3-hour break declares a legal day a violation. The exceptions are precise, are each a paragraph of §395.1, and are each a change to the window or the limits rather than a new model.

| Exception | Paragraph | Rule as written |
| --- | --- | --- |
| Sleeper berth | §395.1(g)(1) | Ten hours off may be accumulated as two periods where "Neither rest period is shorter than 2 consecutive hours", "One rest period is at least 7 consecutive hours in the sleeper berth", and "The total of the two periods is at least 10 hours" ((g)(1)(ii)(A)–(C)). "The 14-hour driving window … does not include qualifying rest periods" ((g)(1)(iii)) and is re-calculated from the end of the first period. The familiar "7/3" and "8/2" are the integer pairs that satisfy the three constraints, not names the rule uses; 7.5/2.5 qualifies too. |
| Adverse driving conditions | §395.1(b)(1) | Driving "for not more than two additional hours beyond the maximum allowable hours" when the driver "cannot, because of those conditions, safely complete the run within the maximum driving time or duty time during which driving is permitted". The two extra hours apply to the driving limit and, by that reference to duty time, to the window; the paragraph itself never says "16". |
| Short-haul | §395.1(e)(1) | The driver "operates within a 150 air-mile radius (172.6 statute miles) of the normal work reporting location", "returns to the work reporting location and is released from work within 14 consecutive hours", has "at least 10 consecutive hours off-duty separating each 14 hours on-duty" (8 for passenger-carrying), and keeps time records in place of records of duty status |
| 16-hour | §395.1(o) | Once the carrier "released the driver from duty at that location for the previous five duty tours", the driver may be released "within 16 hours after coming on duty following 10 consecutive hours off duty", provided the driver "has not taken this exemption within the previous 6 consecutive days, except when the driver has begun a new 7- or 8-consecutive day period with the beginning of any off-duty period of 34 or more consecutive hours" |

([49 CFR 395.1](https://www.law.cornell.edu/cfr/text/49/395.1))

## Scope

- `packages/gmt/src/road/calculate/sleeperBerthSplit.ts`:
  - `sleeperBerthPairs(log: DutyEntry[], at: string, options: FmcsaOptions): { pairs: { first: Interval, second: Interval }[], windowExcluded: string }` — The qualifying pairings in effect under (g)(1)(ii)(A)–(C) and the time they remove from the 14-hour window.
  - `fmcsaStatusWithSplit(log, at, options): ReturnType<typeof fmcsaStatus>` — ROAD-20's status with §395.1(g)(1)(iii) applied.
- `packages/gmt/src/road/calculate/hosExceptions.ts`:
  - `adverseConditionsExtension(log, at, options & { declaredAt: string }): ReturnType<typeof fmcsaStatus>` — The two-hour extension, applied only from the instant the caller declares the condition; GMT cannot know the weather.
  - `shortHaulStatus(log, at, options & { withinRadius: boolean, returnedBy?: string }): { eligible: boolean, breakRequired: boolean, windowRemaining: string }` — Eligibility from caller-supplied facts (the radius is a distance GMT does not compute) and the 14-hour return test, which it does.
  - `sixteenHourAvailable(log, at, options & { returnedToReportingLocationTours: number }): { available: boolean, usedWithinSixDays: boolean, nextAvailableAt: string | null }`

## Design notes

- **Each exception is a change to ROAD-20's inputs, not a new engine.** The status functions here compose `fmcsaStatus` with an adjusted window or limit, so the two can never disagree about the base rules.
- **Facts GMT cannot know are parameters.** Whether conditions were adverse, whether the driver stayed within 150 air miles, whether the last five tours ended at the reporting location — these are the carrier's facts and are passed in. What GMT contributes is the temporal test on each: was the condition declared before the extension is used, was the return within 14 hours, has the 16-hour exception been used in the previous six days.
- **Pairing is by the three constraints, not by a lookup of "7/3".** Either period may come first; the JSDoc quotes (g)(1)(ii)(A)–(C) and the pairs returned name both intervals so the log can be audited. A 7-hour berth period alone excludes nothing until its partner exists.
- **The 16-hour exception is "not within the previous 6 consecutive days", reset by a 34-hour restart** — not "once per 7 days"; the difference is one day and one restart, and the JSDoc quotes (o)(3).
- **Passenger-carrying sleeper rules differ** (§395.1(g)(3)) and are implemented under `driverType: 'passenger'` only once that paragraph is quoted in the JSDoc; until then the function returns the sentinel for passenger logs rather than guessing.
- The 30-minute break, cycle and restart rules are unchanged by every exception except short-haul, and the JSDoc says so per paragraph.

## What gmt provides (do not re-implement)

- `fmcsaStatus` / `dutyDayFor` / `DutyEntry` / `FmcsaOptions` from ROAD-20 — the base model
- `mergeIntervals` / `subtractIntervals` / `sumIntervals` from CORE-6 — pairing and window subtraction
- `bucketRange` from CORE-5 — the six-day lookback for the 16-hour exception
- `spanMs` from CORE-2 — elapsed time

## Verification

- A 7-hour sleeper period followed by driving and then a 3-hour off-duty period forms a qualifying pair; the window remaining after the pair equals 14 hours minus driving and on-duty time only, with both periods excluded, asserted
- A 7.5-hour berth period paired with 2.5 hours off qualifies (the constraints, not the integers, decide); a 6-hour berth period with 4 hours off does not (no period of at least 7 in the berth); a 7-hour berth period with a 1-hour break does not (a period shorter than 2 hours)
- `adverseConditionsExtension` with `declaredAt` before the 11th driving hour permits driving to 13 hours and extends the window by two hours; declared after the limit is reached it permits nothing
- `shortHaulStatus` with `withinRadius: true` and return within 14 hours reports `breakRequired: false`; a return at 14 hours 1 minute reports `eligible: false`
- `sixteenHourAvailable` is `true` when the exception has not been used in the previous six carrier-designated days, `false` on the sixth day after a use, and `true` again after a 34-hour restart, with `nextAvailableAt` set
- Every exception composed with ROAD-20 on a log where it does not apply returns exactly ROAD-20's result, asserted
- `pnpm run validate` stays green
