# HLTH-38 — Healthcare: Medication administration windows

**Scope:** Expanding a FHIR `Timing` into concrete administration windows, including across DST transitions.

## Gap

Medication schedules are expressed as a frequency and a period (`BID`, `TID`, every eight hours) bounded by a treatment period, and a system has to turn that into actual times. The temporal hazard is well known to anyone who has run a hospital system through a clock change: **on a spring-forward night the 02:00 dose does not exist, and on a fall-back night it occurs twice.** Naive expansion either skips or duplicates a medication administration.

The same problem applies to any schedule anchored to local time, but here the failure mode is a clinical incident.

FHIR's `Timing.repeat` carries more than frequency and period: `count`/`countMax`, `duration`/`durationMax`, `frequencyMax`/`periodMax` ranges, `dayOfWeek`, `timeOfDay`, an `offset` in minutes ("If the event code does not indicate whether the minutes is before or after the event, then the offset is assumed to be after the event"), and `when` — 26 EventTiming codes such as `MORN`, `MORN.early`, `AFT.late`, `AC` (before meals), `PCV` (after dinner), `HS` (at bedtime), `WAKE`, `PHS`. Those events have no clock time in the standard — the definitions say "the exact time is unspecified and established by institution convention or patient interpretation".
([FHIR R4 §2.24.0.16 `Timing`](https://hl7.org/fhir/R4/datatypes.html#Timing), [EventTiming value set 4.0.1](https://hl7.org/fhir/R4/valueset-event-timing.html))

## Scope

- `packages/gmt/src/health/calculate/timingWindows.ts`:
  - `expandTiming(timing: TimingRepeat, options: { timeZone: string, dstPolicy: 'preserveWallClock' | 'preserveInterval', eventTimes?: Record<EventTiming, string> }): { at: string, wallClock: string, dstAnomaly?: 'skipped' | 'repeated' }[] | null`
  - `TimingRepeat` mirrors FHIR R4 `Timing.repeat`: `{ boundsPeriod: Interval, count?: number, frequency: number, frequencyMax?: number, period: number, periodMax?: number, periodUnit: 's' | 'min' | 'h' | 'd' | 'wk' | 'mo', dayOfWeek?: number[], timeOfDay?: string[], when?: EventTiming[], offset?: number }`.
- `packages/gmt/src/health/calculate/administrationWindow.ts`:
  - `administrationWindow(scheduledAt: string, tolerance: string): Interval` — The window in which an administration counts as on time.
  - `classifyAdministration(administeredAt: string, scheduledAt: string, tolerance: string): 'early' | 'onTime' | 'late' | 'missed'`
- Docs site (`apps/dox/src/content/docs/`, per [../docs-site.md](../docs-site.md)): the health guide gains "Encounter durations", with no new function — midnights crossed as `dwellTime(admitted, discharged, hospitalZone).calendarDays - 1`, calendar days touched as `calendarDays`, exact elapsed time as `duration`, and observation hours as `sumIntervals(subtractIntervals([stay], excluded))` rounded down to whole hours. Examples are labelled by their numbers: a stay from 23:30 to 00:30 crosses one midnight in one hour; a stay crossing two midnights; a stay across a fall-back night whose elapsed time is one hour longer than its wall-clock span. Which counts a payer or a policy uses is the caller's.

## Design notes

- **`dstPolicy` is required and has no default.** The two policies give different, both-defensible answers, and the choice is clinical rather than technical:
  - `'preserveWallClock'` keeps doses at 08:00 / 20:00 local, so one interval on a transition day is 23 or 25 hours.
  - `'preserveInterval'` keeps doses exactly 12 hours apart, so the local time shifts.
  For a drug with a strict interval requirement the second is correct; for most oral regimens the first is. GMT must not choose.
- **`dstAnomaly` is reported, never silently resolved.** A dose falling in a nonexistent local hour is flagged `'skipped'`, and one in a repeated hour is flagged `'repeated'`, so the consumer can surface it rather than discovering it in an administration record.
- **`when` codes resolve only against caller-supplied `eventTimes`.** "Before breakfast" is 07:30 on one ward and 06:45 on another; FHIR deliberately gives no clock time. A `when` code with no matching `eventTimes` entry returns the sentinel — inventing a mealtime is exactly the kind of quantity this epic forbids. `offset` applies after the event time, per the standard.
- **Ranges (`frequencyMax`, `periodMax`) are expanded at the stated minimum and reported as ranges**, not collapsed: "2–3 times a day" is a prescriber's latitude, and the expansion documents which bound it used.
- `'missed'` is distinct from `'late'` and is determined by the tolerance window, which is caller-supplied — tolerance varies by drug and by institutional policy.
- This expands a schedule. It does not decide whether a dose is due, which depends on clinical state GMT has no access to.

## Corrections

- A length-of-stay story was cut. Midnights crossed are `dwellTime(...).calendarDays - 1` and observation hours are CORE-6 interval sums, both already shipped; the inpatient-day counting rule and the two-midnight test it specced were a payer's law (tracker, "GMT tracks no law"). The hospital example lives on this story's guide, since local-day boundaries in the hospital's zone are already its subject.

## What gmt provides (do not re-implement)

- `resolveLocal` / `classifyLocal` from CORE-4 — nonexistent and ambiguous local times, which is precisely the DST anomaly detection
- `bucketRange` from CORE-5 — zone-aware interval walking
- `intervalContains` from CORE-6 — window membership
- `subtractIntervals` / `sumIntervals` from CORE-6 — observation hours on the guide
- `dwellTime` from TRAN-8 — midnights crossed and calendar days touched on the guide
- `addDuration` — interval arithmetic

## Verification

- `BID` at 08:00 and 20:00 over a week yields fourteen windows
- On a spring-forward date with a 02:00 dose, `'preserveWallClock'` reports `dstAnomaly: 'skipped'`
- On a fall-back date with a 02:00 dose, the same policy reports `'repeated'` and yields two candidate instants
- `'preserveInterval'` across the same transition keeps consecutive doses exactly the stated duration apart, and the local wall time shifts
- `'preserveWallClock'` across the same transition yields one 23-hour and one 25-hour gap in the respective directions
- An eight-hourly schedule bounded by a two-day period yields six windows
- `count: 5` truncates the expansion to five windows regardless of bounds
- `dayOfWeek: [1, 3, 5]` with `timeOfDay: ['09:00']` over two weeks yields six windows on the right weekdays
- `when: ['ACM']` with `eventTimes: { ACM: '07:30' }` and `offset: 30` yields 08:00 doses; without `eventTimes` it returns the sentinel
- `classifyAdministration` returns `'onTime'` at the tolerance boundary and `'late'` one second beyond
- Missing `dstPolicy` returns the sentinel
- The guide's encounter-duration examples match `dwellTime`, `subtractIntervals` and `sumIntervals` in the built package: the 23:30-to-00:30 stay reports `calendarDays: 2` and one midnight; the fall-back stay reports elapsed time one hour longer than its wall-clock span
- `battleTestTimeZones` coverage plus probe-zone transition rows for timezone-aware functions (see `context/coding-standards.md` § Calendar & zone semantics)
- `pnpm run validate` stays green
