# HLTH-70 — Healthcare: ACGME clinical and educational work hours

**Scope:** The Accreditation Council for Graduate Medical Education limits on resident work hours, as rolling averages and interval tests over a duty log.

## Gap

Every US residency programme must demonstrate compliance with the ACGME Common Program Requirements on clinical experience and education, and programmes do it with self-reported logs and spreadsheets. The requirements are numeric and are a third member of the hours-of-work family alongside drivers and crews, with a twist the other two lack: the headline limit is an **average over four weeks**, and one rule is stated as "should" (a Detail requirement) rather than "must" (a Core requirement).

The ACGME renumbered the section in its September 2025 reformatted requirements; the text is unchanged. Both numberings are given because programmes cite either.

| 2023 (VI.F) | 2025 (6.2x) | Requirement | Type |
| --- | --- | --- | --- |
| VI.F.1 | 6.20 | "limited to no more than 80 hours per week, averaged over a four-week period", including all in-house clinical and educational activities, clinical work done from home, and all moonlighting | Core |
| VI.F.2.a) | 6.21 | "Residents should have eight hours off between scheduled clinical work and education periods." | Detail |
| VI.F.2.b) | 6.21.a | "Residents must have at least 14 hours free of clinical work and education after 24 hours of in-house call." | Core |
| VI.F.2.c) | 6.21.b | "a minimum of one day in seven free of clinical work and required education (when averaged over four weeks)"; at-home call cannot be assigned on those days | Core |
| VI.F.3.a) | 6.22 | "must not exceed 24 hours of continuous scheduled clinical assignments" | Core |
| VI.F.3.a).(1) | 6.22.a | "Up to four hours of additional time may be used for activities related to patient safety, such as providing effective transitions of care" | Core |
| VI.F.4.c) | 6.24 | Rotation-specific exceptions "for up to 10 percent or a maximum of 88 clinical and educational work hours" | — |
| VI.F.5.b) | 6.25.a | Internal and external moonlighting "must be counted" toward the 80-hour limit | Core |
| VI.F.7 | 6.27 | "in-house call no more frequently than every third night (when averaged over a four-week period)" | Core |
| VI.F.8.a) | 6.28 | At-home call is "not subject to the every-third-night limitation, but must satisfy the requirement for one day in seven" | Core |

A "day off" is "one (1) continuous 24-hour period free from all administrative, clinical, and educational activities" (ACGME Glossary, quoted in the Background).

([ACGME Common Program Requirements (Residency), 2025 reformatted interim revision, effective 3 September 2025, §6.20–6.28](https://www.acgme.org/globalassets/pfassets/programrequirements/2025-reformatted-requirements/cprresidency_2025_reformatted.pdf), [2023 v3 edition, Section VI.F](https://www.acgme.org/globalassets/pfassets/programrequirements/cprresidency_2023v3.pdf))

## Scope

- `packages/gmt/src/health/calculate/acgmeWorkHours.ts`:
  - `acgmeWorkHoursStatus(log: ResidentDutyEntry[], at: string, options: { timeZone: string, averagingWeeks?: 4, weeklyLimitHours?: 80 | 88 }): { weeklyAverage: string, weeklyByWeek: { week: Interval, hours: string }[], longestContinuous: string, daysFreeInPeriod: number, callNightsInPeriod: number, callFrequency: number, violations: Violation[], advisories: Violation[] } | null`
- `packages/gmt/src/health/calculate/acgmeRest.ts`:
  - `postCallRestStatus(log, at, options): { required: string, satisfied: boolean, requiredBy: string | null }` — The 14-hours-after-24-hours-call rule (6.21.a).
  - `betweenShiftRest(log, at, options): { shortest: string, meetsEightHours: boolean }` — The 6.21 "should".
- `ResidentDutyEntry` is `DutyEntry` with `status: 'clinical' | 'education' | 'inHouseCall' | 'homeCall' | 'moonlighting' | 'transition' | 'off'`.

## Design notes

- **Averages are over the programme's four-week block in local time**, and `weeklyByWeek` exposes each week so a 100-hour week hidden inside an 80-hour average is visible. The averaging window is a parameter because programmes define the block boundaries; the default is the ACGME's four weeks. `weeklyLimitHours: 88` exists for the approved rotation-specific exception (6.24) and is never a default.
- **"Must" produces a violation; "should" produces an advisory.** The eight hours between shifts (6.21) is a Detail requirement worded "should"; reporting it as a violation misstates the requirement, and dropping it loses a rule programmes track. Two lists, each citing its clause in both numberings.
- **Transition time is its own status** so the 24 + 4 rule can be tested: 24 hours of `clinical`/`inHouseCall` followed by up to 4 hours of `transition` is compliant (6.22.a); a 25th hour of clinical work is not.
- **A day off is a continuous 24-hour period**, not a calendar date, per the Glossary definition; `daysFreeInPeriod` counts 24-hour runs free of every non-`off` status, and at-home call breaks the run (6.21.b).
- **Home call counts by what it interrupts.** Time spent in the hospital during home call counts toward the 80 hours; home call is exempt from every-third-night (6.28) but not from one-in-seven; the JSDoc quotes both clauses because the treatment is not obvious.
- Specialty-specific exceptions beyond 6.24 are out of scope.

## What gmt provides (do not re-implement)

- `DutyEntry` from ROAD-20 — the base duty-log shape this extends
- `bucketRange` / `floorToZone` from CORE-5 — local weeks and days in the programme's zone
- `mergeIntervals` / `sumIntervals` / `subtractIntervals` from CORE-6 — hour totals and gaps
- `spanMs` from CORE-2 — continuous-period length

## Verification

- Four weeks of 80, 80, 80 and 80 hours average 80 with no violation; 100, 60, 80, 80 also average 80 with no violation but `weeklyByWeek` shows the 100
- 84 hours averaged over four weeks is a violation citing 6.20 / VI.F.1; with `weeklyLimitHours: 88` it is not
- 24 hours of continuous clinical work followed by 4 hours of `transition` is compliant; 25 hours of clinical work is a violation citing 6.22 / VI.F.3.a)
- After a 24-hour in-house call, 13 hours off is a violation citing 6.21.a and 14 hours is compliant; 7 hours between two ordinary shifts is an advisory citing 6.21, not a violation
- Three continuous 24-hour periods free in a 28-day period is a violation of one-in-seven; four is compliant; a 24-hour period interrupted by an hour of home call does not count as a day off
- Ten in-house call nights in 28 days is a violation of every-third-night (6.27); nine is compliant; home-call nights are not counted toward it
- Moonlighting hours are included in the weekly total, asserted
- Overlapping or unordered entries return the sentinel
- `pnpm run validate` stays green
