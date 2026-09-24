# RAI-63 — Rail: FRA hours of service for train and signal employees

**Scope:** The US federal statutory limits on railroad employee duty hours (49 U.S.C. §§21103–21104) as time arithmetic over a duty log.

## Gap

Rail crews have a hours-of-service statute older than trucking's and structurally different from it: limits on consecutive hours on duty rather than driving hours, a monthly cap, mandatory rest keyed to consecutive days worked, and a category of time — "limbo time", deadheading from a duty assignment to final release — that is neither on duty nor off duty and has its own cap. Crew-management systems implement it, and get the monthly and consecutive-day counts wrong at month boundaries and time-zone changes.

| Rule | Train employees, 49 U.S.C. §21103 | Signal employees, §21104 |
| --- | --- | --- |
| Maximum on duty | "in excess of 12 consecutive hours" is prohibited (§21103(a)(2)) | "in excess of 12 consecutive hours" (§21104(a)(1)) |
| Rest before going on duty | "at least 10 consecutive hours off duty during the prior 24 hours" (§21103(a)(3)) | the same 10 hours in the prior 24 (§21104(a)(2)); up to "4 additional hours in any period of 24 consecutive hours when an emergency exists" (§21104(c)) |
| Monthly cap | 276 hours per calendar month on duty, waiting for or in deadhead transportation, or in other mandatory service (§21103(a)(1)) | — |
| Consecutive days | after 6 consecutive days initiating an on-duty period, 48 consecutive hours off at the home terminal; after 7 (where a collective agreement or pilot programme allows), 72 hours (§21103(a)(4)(A)–(B)) | — |
| Limbo time | time "waiting for deadhead transportation" or "in deadhead transportation" from a duty assignment to final release is neither on nor off duty; capped at 40 hours per calendar month, then 30 (§21103(c)(1)(A)–(B); the transition wording between the two caps is to be quoted at implementation); §21103(c)(4) is the make-up rule, not the cap | — |
| Communication during rest | the carrier may not contact the employee during the minimum off-duty period in a way that could disturb rest (§21103(e)) | — |

([49 U.S.C. §21103](https://www.law.cornell.edu/uscode/text/49/21103), [49 U.S.C. §21104](https://www.law.cornell.edu/uscode/text/49/21104))

## Scope

- `packages/gmt/src/rail/calculate/fraHoursStatus.ts`:
  - `fraHoursStatus(log: RailDutyEntry[], at: string, options: { homeTerminalZone: string, employee: 'train' | 'signal', sevenDayAgreement?: boolean }): { onDutyRemaining: string, restRequired: string, restSatisfied: boolean, monthOnDuty: string, monthRemaining: string, limboThisMonth: string, consecutiveDays: number, extendedRestDue: string | null, violations: Violation[] } | null`
- `packages/gmt/src/rail/calculate/fraDutyTime.ts`:
  - `fraOnDutyTime(entries: RailDutyEntry[]): { onDuty: string, limbo: string, offDuty: string }` — The statute's classification: time on duty includes deadhead **to** an assignment; deadhead **from** an assignment to final release is limbo; everything else is off duty.
- `RailDutyEntry` is `DutyEntry` with `status: 'onDuty' | 'deadheadTo' | 'deadheadFrom' | 'interimRelease' | 'off'`.

## Design notes

- **"Calendar month" is a local month in the home-terminal zone.** The 276-hour and limbo caps reset at local midnight on the first of the month, and a duty tour that spans the boundary is split at it (CORE-5 buckets), which is where hand-rolled counters drift.
- **Consecutive days are counted by the day an on-duty period *initiates*.** Six tours starting on six consecutive local dates trigger the 48-hour rest even if they were short; two tours on one date count once. That is the statutory wording and the JSDoc quotes it.
- **Limbo is a third state, not a rounding of the other two.** Classifying it into on-duty over-counts the 276 hours; into off-duty breaks the rest test. `RailDutyEntry` therefore extends the shared `DutyEntry` with the deadhead directions rather than reusing `onDuty`/`off`.
- **The 7-day option is a parameter** because it exists only under a collective-bargaining agreement or pilot programme; absent the flag the 6-day rule applies.
- Hours-of-service for dispatching service employees (§21105) and the FRA's 2011 passenger-crew regulations (49 CFR 228 Subpart F, with their fatigue-model requirement) are out of scope and documented as such; a fatigue model is not time math.

## What gmt provides (do not re-implement)

- `DutyEntry` from ROAD-20 — the base duty-log shape this extends
- `bucketRange` / `floorToZone` from CORE-5 — local calendar months and dates in the home-terminal zone
- `mergeIntervals` / `subtractIntervals` / `sumIntervals` / `splitIntervalAt` from CORE-6 — duty and limbo interval math
- `spanMs` from CORE-2 — elapsed time

## Verification

- 12 consecutive hours on duty returns `onDutyRemaining: 'PT0S'`; a 13th hour is a violation
- Going on duty with only 9 hours 59 minutes off in the prior 24 hours is a violation; 10 hours is not
- For a signal employee, 9 hours 59 minutes off in the prior 24 hours is a violation and 10 hours is not; with an `emergency` flag set by the caller, a 16th consecutive hour is permitted and a 17th is a violation (§21104(c))
- A tour spanning local midnight on the last day of the month contributes hours to both months' 276-hour totals, split at the home-terminal midnight
- `fraOnDutyTime` classifies deadhead-to as on duty and deadhead-from as limbo; limbo exceeding the applicable cap (30 hours, or 40 under the transitional clause the caller selects) in a month is a violation citing §21103(c)(1) and does not appear in `monthOnDuty`
- Six consecutive local dates each initiating a tour produce `extendedRestDue` 48 hours after the sixth ends; with `sevenDayAgreement: true` the seventh triggers 72 hours
- Two tours initiated on the same local date count as one consecutive day
- Overlapping or unordered entries return the sentinel
- `pnpm run validate` stays green
